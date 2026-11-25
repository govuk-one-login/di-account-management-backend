#!/usr/bin/env bash
# Runs a command with the emulator environment from `npm run local:up`, without
# changing your shell:  bash dev/local/with-emulator.sh aws sts get-caller-identity
set -euo pipefail

ENV_FILE="${EMULATOR_ENV_FILE:-$HOME/.aws/emulator/9297.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE not found. Run: npm run local:up" >&2
  exit 1
fi

# shellcheck disable=SC1090
. "$ENV_FILE"
exec "$@"
