#!/usr/bin/env bash
# Tests the duplicate-record merge behaviour of update-inactive-account-tracker.ts.
#
# A race condition can leave a user with more than one row in the inactive account
# tracker table. Because the table's primary key is (dateForDeletion [HASH],
# commonSubjectId [RANGE]), duplicates for the same user always differ by
# dateForDeletion. This script:
#   1. Seeds TWO tracker rows for the same commonSubjectId with different
#      dateForDeletion values (a simulated race condition).
#   2. Inserts a matching auth event into the raw_events table. The tracker lambda
#      is subscribed to the raw_events DynamoDB stream (filtered on event_name), so
#      this triggers update-inactive-account-tracker.
#   3. Polls the tracker table until the duplicates collapse into a single merged
#      row, then prints the result.
#
# The lambda should merge the duplicates (taking the most recently updated fields)
# and delete the stale row, leaving exactly one row for the user.
#
# Usage:
#   ./dev/test-duplicate-tracker-merge.sh [--user-id <id>] [--tracker-table <name>] \
#       [--events-table <name>] [--profile <aws-profile>] [--region <region>] [--no-trigger]
#
# Defaults:
#   user-id:        auto-generated (dup-test-<uuid>)
#   tracker-table:  inactive_account_tracker_store
#   events-table:   raw_events
#   region:         eu-west-2
#
# --no-trigger only seeds the duplicates and skips the event/verification steps.

set -euo pipefail

USER_ID=""
TRACKER_TABLE="inactive_account_tracker_store"
EVENTS_TABLE="raw_events"
REGION="eu-west-2"
PROFILE_ARG=""
TRIGGER=true

while [[ $# -gt 0 ]]; do
  case $1 in
  --user-id)
    USER_ID="$2"
    shift 2
    ;;
  --tracker-table)
    TRACKER_TABLE="$2"
    shift 2
    ;;
  --events-table)
    EVENTS_TABLE="$2"
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
  --no-trigger)
    TRIGGER=false
    shift
    ;;
  *)
    echo "Unknown arg: $1"
    exit 1
    ;;
  esac
done

if [[ -z "$USER_ID" ]]; then
  USER_ID="dup-test-$(uuidgen | tr '[:upper:]' '[:lower:]')"
fi

# The tracker lambda's stream filter only matches these event names. AUTH_AUTH_CODE_ISSUED
# (used by other dev scripts) is deliberately NOT one of them, so use one that is.
TRIGGER_EVENT_NAME="AUTH_TOKEN_SENT_TO_ORCHESTRATION"

# Cross-platform (macOS/BSD and GNU) date helper: returns a YYYY-MM-DD date offset
# from today by the given number of days. Accepts a signed or unsigned integer
# (e.g. 1824, +1824, -1). BSD `date -v` requires an explicit +/- sign, so we
# normalise a bare positive number to a leading '+'.
date_days_from_now() {
  local days="$1"
  # Normalise: ensure a leading sign for BSD date's -v flag.
  if [[ "$days" =~ ^[0-9]+$ ]]; then
    days="+$days"
  fi
  date -u -v"${days}"d +%Y-%m-%d 2>/dev/null \
    || date -u -d "${days} days" +%Y-%m-%d
}

# Two distinct dateForDeletion values (~5 years out) so the two rows are distinct
# primary keys, as a real race condition would produce.
DELETION_DATE_OLD="$(date_days_from_now 1824)"    # ~5y
DELETION_DATE_NEW="$(date_days_from_now 1826)"    # ~5y + 2 days (newer activity)

# Per-field "last updated" timestamps. The NEWER row wins userLastActive/status;
# the OLDER row holds a more recently updated email, to prove field-level merging.
ACTIVITY_UPDATED_OLD="2025-01-01T00:00:00.000Z"
ACTIVITY_UPDATED_NEW="2026-06-01T00:00:00.000Z"
EMAIL_UPDATED_OLD="2020-01-01T00:00:00.000Z"
EMAIL_UPDATED_NEW="2026-08-01T00:00:00.000Z"

echo "================================================================"
echo " Duplicate tracker merge test"
echo "================================================================"
echo "  Tracker table:   $TRACKER_TABLE"
echo "  Events table:    $EVENTS_TABLE"
echo "  Region:          $REGION"
echo "  User (subject):  $USER_ID"
echo "  Row A dateForDeletion (stale/older activity): $DELETION_DATE_OLD"
echo "  Row B dateForDeletion (newer activity):       $DELETION_DATE_NEW"
echo ""

put_tracker_row() {
  local date_for_deletion="$1"
  local user_last_active="$2"
  local activity_updated="$3"
  local status="$4"
  local status_updated="$5"
  local email="$6"
  local email_updated="$7"
  local description="$8"

  echo "  Seeding row ($description)"
  aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
    --table-name "$TRACKER_TABLE" \
    --item "{
      \"dateForDeletion\": {\"S\": \"$date_for_deletion\"},
      \"commonSubjectId\": {\"S\": \"$USER_ID\"},
      \"publicSubjectId\": {\"S\": \"public-$USER_ID\"},
      \"userLastActive\": {\"S\": \"$user_last_active\"},
      \"userLastActiveSource\": {\"S\": \"SEED_EVENT\"},
      \"userLastActiveUpdated\": {\"S\": \"$activity_updated\"},
      \"status\": {\"S\": \"$status\"},
      \"statusLastUpdated\": {\"S\": \"$status_updated\"},
      \"emailAddress\": {\"S\": \"$email\"},
      \"emailAddressSource\": {\"S\": \"SEED_EVENT\"},
      \"emailAddressLastUpdated\": {\"S\": \"$email_updated\"},
      \"hasSetupMfa\": {\"BOOL\": false}
    }" >/dev/null
}

count_rows() {
  aws dynamodb query $PROFILE_ARG --region "$REGION" \
    --table-name "$TRACKER_TABLE" \
    --index-name CommonSubjectIdIndex \
    --key-condition-expression "commonSubjectId = :uid" \
    --expression-attribute-values "{\":uid\": {\"S\": \"$USER_ID\"}}" \
    --select COUNT \
    --query 'Count' --output text
}

print_rows() {
  aws dynamodb query $PROFILE_ARG --region "$REGION" \
    --table-name "$TRACKER_TABLE" \
    --index-name CommonSubjectIdIndex \
    --key-condition-expression "commonSubjectId = :uid" \
    --expression-attribute-values "{\":uid\": {\"S\": \"$USER_ID\"}}" \
    --output json
}

cleanup_rows() {
  # Delete every remaining row for this user so repeated runs start clean.
  local dates
  dates=$(aws dynamodb query $PROFILE_ARG --region "$REGION" \
    --table-name "$TRACKER_TABLE" \
    --index-name CommonSubjectIdIndex \
    --key-condition-expression "commonSubjectId = :uid" \
    --expression-attribute-values "{\":uid\": {\"S\": \"$USER_ID\"}}" \
    --query 'Items[].dateForDeletion.S' --output text)
  for d in $dates; do
    aws dynamodb delete-item $PROFILE_ARG --region "$REGION" \
      --table-name "$TRACKER_TABLE" \
      --key "{\"dateForDeletion\": {\"S\": \"$d\"}, \"commonSubjectId\": {\"S\": \"$USER_ID\"}}" >/dev/null
  done
}

# ---------------------------------------------------------------------------
# 1. Seed the duplicate rows
# ---------------------------------------------------------------------------
echo "Step 1: seeding duplicate tracker rows..."
put_tracker_row "$DELETION_DATE_OLD" "2025-01-01T00:00:00.000Z" "$ACTIVITY_UPDATED_OLD" \
  "pending" "$ACTIVITY_UPDATED_OLD" "fresh-email@example.com" "$EMAIL_UPDATED_NEW" \
  "Row A: older activity, but MOST RECENT email"
put_tracker_row "$DELETION_DATE_NEW" "2026-06-01T00:00:00.000Z" "$ACTIVITY_UPDATED_NEW" \
  "pending" "$ACTIVITY_UPDATED_NEW" "stale-email@example.com" "$EMAIL_UPDATED_OLD" \
  "Row B: most recent activity, but STALE email"
echo ""

echo "Rows for $USER_ID before trigger: $(count_rows)"
echo ""

if [[ "$TRIGGER" != "true" ]]; then
  echo "--no-trigger set: leaving duplicates in place and exiting."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Insert a triggering auth event into raw_events
# ---------------------------------------------------------------------------
echo "Step 2: inserting a $TRIGGER_EVENT_NAME event into $EVENTS_TABLE to trigger the lambda..."
EVENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
EVENT_TS=$(date +%s)
REMOVE_AT=$((EVENT_TS + 14 * 86400))

aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
  --table-name "$EVENTS_TABLE" \
  --item "{
    \"id\": {\"S\": \"$EVENT_ID\"},
    \"timestamp\": {\"N\": \"$EVENT_TS\"},
    \"event\": {\"M\": {
      \"event_id\": {\"S\": \"$EVENT_ID\"},
      \"event_name\": {\"S\": \"$TRIGGER_EVENT_NAME\"},
      \"timestamp\": {\"N\": \"$EVENT_TS\"},
      \"client_id\": {\"S\": \"test-client\"},
      \"user\": {\"M\": {
        \"user_id\": {\"S\": \"$USER_ID\"},
        \"email\": {\"S\": \"fresh-email@example.com\"},
        \"session_id\": {\"S\": \"dup-test-session-$EVENT_TS\"}
      }}
    }},
    \"remove_at\": {\"N\": \"$REMOVE_AT\"}
  }" >/dev/null
echo "  Inserted event $EVENT_ID"
echo ""

# ---------------------------------------------------------------------------
# 3. Poll until the lambda collapses the duplicates into one row
# ---------------------------------------------------------------------------
echo "Step 3: waiting for the lambda to merge the duplicates (polling up to ~60s)..."
MERGED=false
for i in $(seq 1 30); do
  sleep 2
  ROWS=$(count_rows)
  printf "\r  attempt %02d/30 — rows for user: %s   " "$i" "$ROWS"
  if [[ "$ROWS" == "1" ]]; then
    MERGED=true
    break
  fi
done
echo ""
echo ""

echo "Final rows for $USER_ID:"
print_rows
echo ""

if [[ "$MERGED" == "true" ]]; then
  echo "RESULT: PASS — duplicates collapsed into a single merged row."
  echo "        Expected merged values:"
  echo "          userLastActive       = 2026-06-01T00:00:00.000Z (from newer-activity row)"
  echo "          emailAddress         = fresh-email@example.com  (from row with newer emailAddressLastUpdated)"
else
  echo "RESULT: INCONCLUSIVE — still $(count_rows) row(s) after polling."
  echo "        The event may not have been processed yet, or the lambda/stream is not"
  echo "        running in this environment. Re-run the query manually, or check the"
  echo "        UpdateInactiveAccountTracker lambda logs / dead-letter queue."
fi

echo ""
read -rp "Delete the test rows for $USER_ID now? [y/N] " CLEANUP
if [[ "$CLEANUP" == "y" || "$CLEANUP" == "Y" ]]; then
  cleanup_rows
  echo "Cleaned up test rows for $USER_ID."
else
  echo "Left test rows in place. To clean up later, re-run with --no-trigger then delete manually,"
  echo "or delete keys: commonSubjectId=$USER_ID (dateForDeletion in $DELETION_DATE_OLD / $DELETION_DATE_NEW / merged)."
fi
