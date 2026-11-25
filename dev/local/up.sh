#!/usr/bin/env bash
# Starts AWS Emulator in Docker and writes the environment file that the other
# local:* scripts use. See docs/local-development.md.
#
# Environment:
#   EMULATOR_TELEMETRY  "off" (default here) or "on"
#   SKIP_BUILD=1        reuse the existing image instead of rebuilding
#   EXTRA_CA_CERT       PEM file with extra CA certificates to trust while building
#                       (see dev/local/certs/README.md)
set -euo pipefail

PORT=9297
NAME=aws-emulator
IMAGE=aws-emulator
NETWORK=aws-emulator
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$HOME/.aws/emulator/$PORT"
ENV_FILE="$HOME/.aws/emulator/$PORT.env"
REGION=eu-west-2
TELEMETRY="${EMULATOR_TELEMETRY:-off}"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running (or not reachable). Start Docker and retry." >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  echo "Container $NAME is already running."
else
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Port $PORT is already in use by another process." >&2
    exit 1
  fi

  if [[ "${SKIP_BUILD:-}" == "1" ]] && docker image inspect "$IMAGE" >/dev/null 2>&1; then
    echo "Reusing existing image $IMAGE."
  else
    # A TLS-intercepting proxy (e.g. Zscaler) needs its CA trusted by the build.
    if [[ -n "${EXTRA_CA_CERT:-}" ]]; then
      cp "$EXTRA_CA_CERT" "$HERE/certs/extra-ca.pem"
    fi
    # --pull --no-cache: always fetch the latest emulator package.
    echo "Building $IMAGE (latest AWS Emulator package)..."
    docker build --pull --no-cache -t "$IMAGE" "$HERE"
  fi

  # Create the state dir first, otherwise Docker creates it owned by root and
  # the SDKs cannot read the credentials and CA file written into it.
  mkdir -p "$STATE_DIR"
  docker network create "$NETWORK" >/dev/null 2>&1 || true

  # Published on loopback only: never -p 9297:9297, that exposes it to the LAN.
  docker run -d --rm --name "$NAME" \
    --network "$NETWORK" \
    --cap-drop ALL --security-opt no-new-privileges --read-only \
    -p "127.0.0.1:$PORT:$PORT" \
    -v "$STATE_DIR:/home/emulator/.aws/emulator/$PORT" \
    -e "EMULATOR_TELEMETRY=$TELEMETRY" \
    "$IMAGE" >/dev/null
fi

echo "Waiting for the emulator to be ready..."
ready=""
for _ in $(seq 60); do
  if curl -sf --cacert "$STATE_DIR/ca.pem" "https://127.0.0.1:$PORT/__admin/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 1
done
if [[ -z "$ready" ]]; then
  echo "The emulator did not become healthy. Logs:" >&2
  docker logs "$NAME" 2>&1 | tail -20 >&2 || true
  exit 1
fi

# Per-run values (credentials, CA) change every start; this file only points at
# them, so it is safe to regenerate. Never commit anything under ~/.aws/emulator.
cat >"$ENV_FILE" <<ENVEOF
export AWS_ENDPOINT_URL=https://127.0.0.1:$PORT
export AWS_SHARED_CREDENTIALS_FILE=\$HOME/.aws/emulator/$PORT/emulator_credentials
export AWS_CONFIG_FILE=\$HOME/.aws/emulator/$PORT/config
export AWS_EC2_METADATA_DISABLED=true
export AWS_REGION=$REGION
export AWS_DEFAULT_REGION=$REGION

# Real credentials would be sent to the emulator and rejected, so make sure
# none are visible.
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE \\
  AWS_WEB_IDENTITY_TOKEN_FILE AWS_ROLE_ARN AWS_ROLE_SESSION_NAME AWS_CONTAINER_CREDENTIALS_RELATIVE_URI \\
  AWS_CONTAINER_CREDENTIALS_FULL_URI AWS_CONTAINER_AUTHORIZATION_TOKEN

# The emulator runs in Docker, so the ca_bundle in its config is a container
# path. Point the CLI/SDKs at the host copy. Node's SDK reads NODE_EXTRA_CA_CERTS
# (it must be set before node starts, which is why scripts run via
# with-emulator.sh).
export AWS_CA_BUNDLE=\$HOME/.aws/emulator/$PORT/ca.pem
export NODE_EXTRA_CA_CERTS=\$HOME/.aws/emulator/$PORT/ca.pem

export AWS_PAGER=""
ENVEOF

echo "Emulator is up on https://127.0.0.1:$PORT (telemetry: $TELEMETRY)."
if [[ "$TELEMETRY" != "off" ]]; then
  echo "Telemetry is on. Turn it off with EMULATOR_TELEMETRY=off."
fi

# Prove we are talking to the emulator and not to real AWS.
if command -v aws >/dev/null 2>&1; then
  account="$(bash "$HERE/with-emulator.sh" aws sts get-caller-identity --query Account --output text 2>/dev/null || true)"
  if [[ "$account" != "000000000000" ]]; then
    echo "Expected account 000000000000 from sts get-caller-identity but got '${account:-nothing}'." >&2
    echo "Do not continue until this is fixed." >&2
    exit 1
  fi
  echo "Verified: sts get-caller-identity returns account 000000000000."
fi

echo "Next: npm run local:bootstrap"
