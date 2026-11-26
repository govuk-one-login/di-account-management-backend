#!/usr/bin/env bash
# Stops AWS Emulator. All emulator state is lost, so the files written by
# bootstrap and by the stream runner are removed too.
set -euo pipefail

PORT=9297
NAME=aws-emulator

if docker ps --format '{{.Names}}' | grep -qx "$NAME"; then
  docker stop "$NAME" >/dev/null
  echo "Stopped $NAME."
else
  echo "$NAME is not running."
fi
rm -f "$HOME/.aws/emulator/$PORT.resources.json" "$HOME/.aws/emulator/$PORT.stream-checkpoints.json"
