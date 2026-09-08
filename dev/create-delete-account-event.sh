#!/usr/bin/env bash
# Inserts an AUTH_DELETE_ACCOUNT event into the raw_events DynamoDB table.
# This triggers the publish-account-deletion lambda via DynamoDB Streams.
#
# Usage:
#   ./dev/create-delete-account-event.sh [--table-name <name>] [--profile <aws-profile>] [--region <region>]
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
read -rp "Enter client_id: " CLIENT_ID
read -rp "Enter account_deletion_reason [USER_INITIATED]: " DELETION_REASON
DELETION_REASON="${DELETION_REASON:-USER_INITIATED}"

if [[ -z "$USER_ID" ]]; then
  echo "user_id is required."
  exit 1
fi

if [[ -z "$CLIENT_ID" ]]; then
  echo "client_id is required."
  exit 1
fi

ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
TIMESTAMP=$(date +%s)
TIMESTAMP_MS=$((TIMESTAMP * 1000))
REMOVE_AT=$((TIMESTAMP + 14 * 86400))

echo ""
echo "Creating AUTH_DELETE_ACCOUNT event:"
echo "  Table:     $TABLE_NAME"
echo "  Region:    $REGION"
echo "  User ID:   $USER_ID"
echo "  Client ID: $CLIENT_ID"
echo "  Reason:    $DELETION_REASON"
echo "  Event ID:  $ID"
echo ""

# Note: AUTH_DELETE_ACCOUNT does not require a session_id (see
# EVENTS_WITHOUT_SESSION_ID in src/save-raw-events.ts), but the example event
# includes one so we mirror the full TxMA shape here.
aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
  --table-name "$TABLE_NAME" \
  --item "{
    \"id\": {\"S\": \"$ID\"},
    \"timestamp\": {\"N\": \"$TIMESTAMP\"},
    \"event\": {\"M\": {
      \"event_id\": {\"S\": \"$ID\"},
      \"event_name\": {\"S\": \"AUTH_DELETE_ACCOUNT\"},
      \"component_id\": {\"S\": \"AUTH\"},
      \"client_id\": {\"S\": \"$CLIENT_ID\"},
      \"timestamp\": {\"N\": \"$TIMESTAMP\"},
      \"event_timestamp_ms\": {\"N\": \"$TIMESTAMP_MS\"},
      \"extensions\": {\"M\": {
        \"phone_number_country_code\": {\"S\": \"44\"},
        \"account_deletion_reason\": {\"S\": \"$DELETION_REASON\"}
      }},
      \"restricted\": {\"M\": {
        \"device_information\": {\"M\": {
          \"encoded\": {\"S\": \"encoded_data\"}
        }}
      }},
      \"user\": {\"M\": {
        \"user_id\": {\"S\": \"$USER_ID\"},
        \"email\": {\"S\": \"email\"},
        \"phone\": {\"S\": \"phone\"},
        \"ip_address\": {\"S\": \"0.0.0.0\"},
        \"session_id\": {\"S\": \"session_id\"},
        \"persistent_session_id\": {\"S\": \"persistent_session_id\"},
        \"govuk_signin_journey_id\": {\"S\": \"govuk_signin_journey_id\"},
        \"public_subject_id\": {\"S\": \"urn:fdc:gov.uk:2022:public_subject_id\"},
        \"legacy_subject_id\": {\"S\": \"urn:fdc:gov.uk:2022:legacy_subject_id\"}
      }}
    }},
    \"remove_at\": {\"N\": \"$REMOVE_AT\"}
  }"

echo "Done. Event $ID inserted into $TABLE_NAME."
