#!/bin/bash
# Insert an item into the raw_events DynamoDB table
TABLE_NAME="raw_events"
ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

read -rp "Enter user_id: " USER_ID
read -rp "Enter timestamp (leave blank for now, or relative e.g. +5y, +3d, +2h, +30m): " TS_INPUT
read -rp "Enter client_id: " CLIENT_ID

if [[ "$TS_INPUT" =~ ^\+([0-9]+)([ydhm])$ ]]; then
  VALUE="${BASH_REMATCH[1]}"
  UNIT="${BASH_REMATCH[2]}"
  case "$UNIT" in
  y) OFFSET=$((VALUE * 365 * 86400)) ;;
  d) OFFSET=$((VALUE * 86400)) ;;
  h) OFFSET=$((VALUE * 3600)) ;;
  m) OFFSET=$((VALUE * 60)) ;;
  *) die "Invalid time unit. Use 'y' for years, 'd' for days, 'h' for hours, or 'm' for minutes." ;;
  esac
  TIMESTAMP=$(($(date +%s) + OFFSET))
else
  TIMESTAMP=$(date +%s)
fi

REMOVE_AT=$((TIMESTAMP + 14 * 86400))

aws dynamodb put-item \
  --table-name "$TABLE_NAME" \
  --region eu-west-2 \
  --item "{
      \"id\": {\"S\": \"$ID\"},
      \"timestamp\": {\"N\": \"$TIMESTAMP\"},
      \"event\": {\"M\": {
        \"event_id\": {\"S\": \"$ID\"},
        \"event_name\": {\"S\": \"AUTH_AUTH_CODE_ISSUED\"},
        \"timestamp\": {\"N\": \"$TIMESTAMP\"},
        \"client_id\": {\"S\": \"$CLIENT_ID\"},
        \"user\": {\"M\": {
          \"user_id\": {\"S\": \"$USER_ID\"},
          \"session_id\": {\"S\": \"your-session-id\"}
        }}
      }},
      \"remove_at\": {\"N\": \"$REMOVE_AT\"}
    }"
