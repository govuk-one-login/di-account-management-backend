#!/usr/bin/env bash
# Inserts an AUTH_UPDATE_EMAIL event into the raw_events DynamoDB table.
# This triggers the update-user-email lambda via DynamoDB Streams.
#
# Usage:
#   ./dev/create-update-email-event.sh [--table-name <name>] [--profile <aws-profile>] [--region <region>]
#
# Defaults:
#   table-name: raw_events
#   region: eu-west-2

set -euo pipefail

TABLE_NAME="raw_events"
REGION="eu-west-2"
PROFILE_ARG=""

while [[ $# -gt 0 ]]; do
  case $1 in
  --table-name)
    TABLE_NAME="$2"
    shift 2
    ;;
  --profile)
    PROFILE_ARG="--profile $2"
    shift 2
    ;;
  --region)
    REGION="$2"
    shift 2
    ;;
  *)
    echo "Unknown arg: $1"
    exit 1
    ;;
  esac
done

read -rp "Enter user_id: " USER_ID
read -rp "Enter new email address: " NEW_EMAIL

if [[ -z "$USER_ID" ]]; then
  echo "Error: user_id is required"
  exit 1
fi

if [[ -z "$NEW_EMAIL" ]]; then
  echo "Error: email address is required"
  exit 1
fi

ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TIMESTAMP=$(date +%s)
REMOVE_AT=$((TIMESTAMP + 14 * 86400))

echo ""
echo "Creating AUTH_UPDATE_EMAIL event:"
echo "  Table:    $TABLE_NAME"
echo "  Region:   $REGION"
echo "  User ID:  $USER_ID"
echo "  Email:    $NEW_EMAIL"
echo "  Event ID: $ID"
echo ""

aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"id\": {\"S\": \"$ID\"},
    \"timestamp\": {\"N\": \"$TIMESTAMP\"},
    \"event\": {\"M\": {
      \"event_id\": {\"S\": \"$ID\"},
      \"event_name\": {\"S\": \"AUTH_UPDATE_EMAIL\"},
      \"timestamp\": {\"N\": \"$TIMESTAMP\"},
      \"user\": {\"M\": {
        \"user_id\": {\"S\": \"$USER_ID\"},
        \"email\": {\"S\": \"$NEW_EMAIL\"},
        \"session_id\": {\"S\": \"test-session-$(date +%s)\"}
      }}
    }},
    \"remove_at\": {\"N\": \"$REMOVE_AT\"}
  }"

echo "Done. Event $ID inserted into $TABLE_NAME."
