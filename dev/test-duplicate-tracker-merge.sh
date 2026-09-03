#!/usr/bin/env bash
# Tests the duplicate-record merge behaviour of the inactive-account PROCESSOR
# (process-inactive-account.ts).
#
# A race condition can leave a user with more than one row in the inactive account
# tracker table. Because the table's primary key is (dateForDeletion [HASH],
# commonSubjectId [RANGE]), duplicates for the same user always differ by
# dateForDeletion.
#
# Merging used to happen in the tracker-update lambda (off the raw_events stream).
# It has since moved to the PROCESSOR step: process-inactive-account.ts calls
# mergeDuplicatesBeforeProcessing() at the start of processing an SQS message. That
# function queries ALL rows for the commonSubjectId, merges them (taking each group
# of fields from whichever duplicate updated it most recently), writes the merged
# record to the surviving row, and deletes the stale duplicate rows in a single
# transaction.
#
# The processor is fed by the query-and-dispatch lambda: it queries the tracker
# table by `dateForDeletion = <process target date>`, filters by the process's
# allowedStatuses (and, in manual-test mode, userLastActiveSource == "MANUAL_TEST"),
# and dispatches each matching row as an SQS message onto the process queue. The
# processor then consumes that message and performs the merge.
#
# This script:
#   1. Seeds TWO tracker rows for the same commonSubjectId with different
#      dateForDeletion values (a simulated race condition). At least one row is
#      given the target dateForDeletion for the chosen process (so query-and-dispatch
#      picks the user up), status "pending", and userLastActiveSource "MANUAL_TEST"
#      (so the manual-test dispatch filter matches).
#   2. Triggers the processor by invoking the query-and-dispatch lambda with
#      {processName, manualTestOnly: true} -- exactly how trigger-inactive-account-process
#      drives a manual test. (Use --no-trigger to only seed and skip this.)
#   3. Polls the tracker table until the duplicates collapse into a single merged
#      row, then prints the result.
#
# Usage:
#   ./dev/test-duplicate-tracker-merge.sh [--user-id <id>] [--tracker-table <name>] \
#       [--process-name <name>] [--dispatch-function <name>] \
#       [--profile <aws-profile>] [--region <region>] [--no-trigger]
#
# Defaults:
#   user-id:            auto-generated (dup-test-<uuid>)
#   tracker-table:      inactive_account_tracker_store
#   process-name:       Warning30Day  (daysToDeletion=30, allowedStatuses=[pending])
#   dispatch-function:  auto-discovered by physical-resource pattern, else must be
#                       supplied with --dispatch-function
#   region:             eu-west-2
#
# --no-trigger only seeds the duplicates and skips the dispatch/verification steps.

set -euo pipefail

USER_ID=""
TRACKER_TABLE="inactive_account_tracker_store"
PROCESS_NAME="Warning30Day"
DISPATCH_FUNCTION=""
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
  --process-name)
    PROCESS_NAME="$2"
    shift 2
    ;;
  --dispatch-function)
    DISPATCH_FUNCTION="$2"
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

# The number of days-to-deletion the chosen process queries on. query-and-dispatch
# calculates the target date as (today + daysToDeletion) and queries the tracker
# table's HASH key (dateForDeletion) for an EXACT match, so at least one seeded row
# must use this exact date for the user to be dispatched into the processor.
case "$PROCESS_NAME" in
  Warning30Day) TARGET_DAYS=30 ;;
  Warning7Day)  TARGET_DAYS=7 ;;
  DeleteAccount) TARGET_DAYS=0 ;;
  *)
    echo "Unknown --process-name '$PROCESS_NAME'. Expected one of: Warning30Day, Warning7Day, DeleteAccount." >&2
    exit 1
    ;;
esac

# Cross-platform (macOS/BSD and GNU) date helper: returns a YYYY-MM-DD date offset
# from today by the given number of days. Accepts a signed or unsigned integer
# (e.g. 30, +30, -1). BSD `date -v` requires an explicit +/- sign, so we normalise a
# bare positive number to a leading '+'.
date_days_from_now() {
  local days="$1"
  # Normalise: ensure a leading sign for BSD date's -v flag.
  if [[ "$days" =~ ^[0-9]+$ ]]; then
    days="+$days"
  fi
  date -u -v"${days}"d +%Y-%m-%d 2>/dev/null \
    || date -u -d "${days} days" +%Y-%m-%d
}

# The dispatchable row lands on the process target date so query-and-dispatch picks
# the user up. The stale duplicate uses a different (later) dateForDeletion so the two
# rows are distinct primary keys, exactly as a real race condition would produce. The
# merge is keyed on commonSubjectId, so it collapses BOTH rows regardless of which one
# was the dispatch trigger.
DELETION_DATE_TARGET="$(date_days_from_now "$TARGET_DAYS")"       # dispatchable row
DELETION_DATE_STALE="$(date_days_from_now $((TARGET_DAYS + 2)))"  # extra duplicate

# Per-field "last updated" timestamps that drive the field-level merge in
# merge-tracker-records.ts:
#   - userLastActiveUpdated wins userLastActive + dateForDeletion + publicSubjectId
#   - emailAddressLastUpdated wins the emailAddress group
#   - statusLastUpdated wins status
# The TARGET row has the most recent activity (so it also owns dateForDeletion).
# The STALE row holds a more recently updated email, to prove field-level merging.
ACTIVITY_UPDATED_TARGET="2026-06-01T00:00:00.000Z"
ACTIVITY_UPDATED_STALE="2025-01-01T00:00:00.000Z"
EMAIL_UPDATED_TARGET="2020-01-01T00:00:00.000Z"
EMAIL_UPDATED_STALE="2026-08-01T00:00:00.000Z"

echo "================================================================"
echo " Duplicate tracker merge test (processor step)"
echo "================================================================"
echo "  Tracker table:   $TRACKER_TABLE"
echo "  Process:         $PROCESS_NAME (daysToDeletion=$TARGET_DAYS)"
echo "  Region:          $REGION"
echo "  User (subject):  $USER_ID"
echo "  Row TARGET dateForDeletion (dispatched, newest activity): $DELETION_DATE_TARGET"
echo "  Row STALE  dateForDeletion (extra duplicate, newest email): $DELETION_DATE_STALE"
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
  # userLastActiveSource MUST be MANUAL_TEST: query-and-dispatch's manualTestOnly
  # filter only dispatches rows whose userLastActiveSource == "MANUAL_TEST".
  aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
    --table-name "$TRACKER_TABLE" \
    --item "{
      \"dateForDeletion\": {\"S\": \"$date_for_deletion\"},
      \"commonSubjectId\": {\"S\": \"$USER_ID\"},
      \"publicSubjectId\": {\"S\": \"public-$USER_ID\"},
      \"userLastActive\": {\"S\": \"$user_last_active\"},
      \"userLastActiveSource\": {\"S\": \"MANUAL_TEST\"},
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

# Best-effort discovery of the query-and-dispatch lambda's physical name. Stacks
# prefix the logical id, so we match on a substring. If nothing (or more than one)
# is found, the caller must pass --dispatch-function.
discover_dispatch_function() {
  aws lambda list-functions $PROFILE_ARG --region "$REGION" \
    --query "Functions[?contains(FunctionName, 'QueryAndDispatch') || contains(FunctionName, 'query-and-dispatch')].FunctionName" \
    --output text 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# 1. Seed the duplicate rows
# ---------------------------------------------------------------------------
echo "Step 1: seeding duplicate tracker rows..."
put_tracker_row "$DELETION_DATE_TARGET" "2026-06-01T00:00:00.000Z" "$ACTIVITY_UPDATED_TARGET" \
  "pending" "$ACTIVITY_UPDATED_TARGET" "stale-email@example.com" "$EMAIL_UPDATED_TARGET" \
  "Row TARGET: dispatchable (target date), most recent activity, STALE email"
put_tracker_row "$DELETION_DATE_STALE" "2025-01-01T00:00:00.000Z" "$ACTIVITY_UPDATED_STALE" \
  "pending" "$ACTIVITY_UPDATED_STALE" "fresh-email@example.com" "$EMAIL_UPDATED_STALE" \
  "Row STALE: extra duplicate, older activity, but MOST RECENT email"
echo ""

echo "Rows for $USER_ID before trigger: $(count_rows)"
echo ""

if [[ "$TRIGGER" != "true" ]]; then
  echo "--no-trigger set: leaving duplicates in place and exiting."
  exit 0
fi

# ---------------------------------------------------------------------------
# 2. Trigger the processor via the query-and-dispatch lambda
# ---------------------------------------------------------------------------
if [[ -z "$DISPATCH_FUNCTION" ]]; then
  echo "Step 2a: discovering the query-and-dispatch lambda..."
  DISPATCH_FUNCTION="$(discover_dispatch_function)"
  # list-functions may return several whitespace-separated matches; require exactly one.
  if [[ -z "$DISPATCH_FUNCTION" || "$DISPATCH_FUNCTION" == *[[:space:]]* ]]; then
    echo "  Could not uniquely resolve the query-and-dispatch function name." >&2
    echo "  Candidates: ${DISPATCH_FUNCTION:-<none>}" >&2
    echo "  Re-run with --dispatch-function <name>." >&2
    exit 1
  fi
  echo "  Using dispatch function: $DISPATCH_FUNCTION"
fi
echo ""

echo "Step 2b: invoking $DISPATCH_FUNCTION with {processName: $PROCESS_NAME, manualTestOnly: true}..."
INVOKE_OUT="$(mktemp)"
aws lambda invoke $PROFILE_ARG --region "$REGION" \
  --function-name "$DISPATCH_FUNCTION" \
  --invocation-type RequestResponse \
  --cli-binary-format raw-in-base64-out \
  --payload "{\"processName\": \"$PROCESS_NAME\", \"manualTestOnly\": true}" \
  "$INVOKE_OUT" >/dev/null
echo "  Dispatch lambda response: $(cat "$INVOKE_OUT")"
rm -f "$INVOKE_OUT"
echo "  (query-and-dispatch has enqueued the account; the processor will merge on consume.)"
echo ""

# ---------------------------------------------------------------------------
# 3. Poll until the processor collapses the duplicates into one row
# ---------------------------------------------------------------------------
echo "Step 3: waiting for the processor to merge the duplicates (polling up to ~60s)..."
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
  echo "        Expected merged values (per merge-tracker-records.ts):"
  echo "          userLastActive   = 2026-06-01T00:00:00.000Z (from newer-activity TARGET row)"
  echo "          dateForDeletion  = $DELETION_DATE_TARGET     (owned by the newest-activity row)"
  echo "          emailAddress     = fresh-email@example.com  (from row with newer emailAddressLastUpdated)"
else
  echo "RESULT: INCONCLUSIVE — still $(count_rows) row(s) after polling."
  echo "        The message may not have been processed yet, or the processor/queue is not"
  echo "        running in this environment. Check that:"
  echo "          - the seeded TARGET row's dateForDeletion ($DELETION_DATE_TARGET) matches the"
  echo "            query-and-dispatch target date for $PROCESS_NAME,"
  echo "          - the ProcessInactiveAccount lambda is deployed and its SQS trigger is enabled,"
  echo "        or inspect the ProcessInactiveAccount lambda logs / dead-letter queue."
fi

echo ""
read -rp "Delete the test rows for $USER_ID now? [y/N] " CLEANUP
if [[ "$CLEANUP" == "y" || "$CLEANUP" == "Y" ]]; then
  cleanup_rows
  echo "Cleaned up test rows for $USER_ID."
else
  echo "Left test rows in place. To clean up later, re-run with --no-trigger then delete manually,"
  echo "or delete keys: commonSubjectId=$USER_ID (dateForDeletion in $DELETION_DATE_TARGET / $DELETION_DATE_STALE / merged)."
fi
