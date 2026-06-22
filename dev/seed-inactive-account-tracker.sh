#!/usr/bin/env bash
# Populates the inactive_account_tracker_store DynamoDB table with test data
# covering all scenarios in query-and-dispatch-inactive-accounts.ts
#
# Usage:
#   ./scripts/seed-inactive-account-tracker.sh [--table-name <name>] [--profile <aws-profile>] [--region <region>]
#
# Defaults:
#   table-name: inactive_account_tracker_store
#   region: eu-west-2

set -euo pipefail

TABLE_NAME="inactive_account_tracker_store"
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

status_pending="pending"
status_30day_warned="30DayWarningSent"
status_7day_warned="7DayWarningSent"
status_permanently_suspended="permenantSuspension"
status_deleting="deleting"

# Calculate target dates relative to today
today=$(date -u +%Y-%m-%d)
in_7_days=$(date -u -v+7d +%Y-%m-%d 2>/dev/null || date -u -d "+7 days" +%Y-%m-%d)
in_30_days=$(date -u -v+30d +%Y-%m-%d 2>/dev/null || date -u -d "+30 days" +%Y-%m-%d)
yesterday=$(date -u -v-1d +%Y-%m-%d 2>/dev/null || date -u -d "-1 day" +%Y-%m-%d)

echo "Table: $TABLE_NAME"
echo "Today (DeleteAccount target): $today"
echo "In 7 days (Warning7Day target): $in_7_days"
echo "In 30 days (Warning30Day target): $in_30_days"
echo "Yesterday (should not be picked up): $yesterday"
echo ""

put_item() {
  local date_for_deletion="$1"
  local common_subject_id="$2"
  local status="$3"
  local description="$4"

  echo "  Adding: $description"
  aws dynamodb put-item $PROFILE_ARG --region "$REGION" \
    --table-name "$TABLE_NAME" \
    --item "{
      \"dateForDeletion\": {\"S\": \"$date_for_deletion\"},
      \"commonSubjectId\": {\"S\": \"$common_subject_id\"},
      \"emailAddress\": {\"S\": \"test-${common_subject_id}@example.com\"},
      \"userLastActive\": {\"S\": \"2025-01-01T00:00:00.000Z\"},
      \"status\": {\"S\": \"$status\"},
      \"statusLastUpdated\": {\"S\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}
    }"
}

# --- Warning30Day process: daysToDeletion=30, allowedStatuses=["pending"] ---
echo "=== Warning30Day scenarios (dateForDeletion = $in_30_days) ==="
put_item "$in_30_days" "user-30day-pending-001" "$status_pending" \
  "ELIGIBLE: pending status, should be dispatched to 30-day warning queue"
put_item "$in_30_days" "user-30day-pending-002" "$status_pending" \
  "ELIGIBLE: another pending account for 30-day warning"
put_item "$in_30_days" "user-30day-already-warned" "$status_30day_warned" \
  "FILTERED OUT: already sent 30-day warning, not in allowedStatuses"
put_item "$in_30_days" "user-30day-7day-warned" "$status_7day_warned" \
  "FILTERED OUT: 7-day warning already sent, not in allowedStatuses"
put_item "$in_30_days" "user-30day-deleting" "$status_deleting" \
  "FILTERED OUT: already in deleting status"
put_item "$in_30_days" "user-30day-suspended" "$status_permanently_suspended" \
  "FILTERED OUT: permanently suspended"
echo ""

# --- Warning7Day process: daysToDeletion=7, allowedStatuses=["pending", "30DayWarningSent"] ---
echo "=== Warning7Day scenarios (dateForDeletion = $in_7_days) ==="
put_item "$in_7_days" "user-7day-pending-001" "$status_pending" \
  "ELIGIBLE: pending status, should be dispatched to 7-day warning queue"
put_item "$in_7_days" "user-7day-30warned-001" "$status_30day_warned" \
  "ELIGIBLE: 30-day warning sent, should be dispatched to 7-day warning queue"
put_item "$in_7_days" "user-7day-already-7warned" "$status_7day_warned" \
  "FILTERED OUT: 7-day warning already sent, not in allowedStatuses"
put_item "$in_7_days" "user-7day-deleting" "$status_deleting" \
  "FILTERED OUT: already in deleting status"
put_item "$in_7_days" "user-7day-suspended" "$status_permanently_suspended" \
  "FILTERED OUT: permanently suspended"
echo ""

# --- DeleteAccount process: daysToDeletion=0, allowedStatuses=["pending", "30DayWarningSent", "7DayWarningSent"] ---
echo "=== DeleteAccount scenarios (dateForDeletion = $today) ==="
put_item "$today" "user-delete-pending-001" "$status_pending" \
  "ELIGIBLE: pending status, should be dispatched to deletion queue"
put_item "$today" "user-delete-30warned-001" "$status_30day_warned" \
  "ELIGIBLE: 30-day warning sent, should be dispatched to deletion queue"
put_item "$today" "user-delete-7warned-001" "$status_7day_warned" \
  "ELIGIBLE: 7-day warning sent, should be dispatched to deletion queue"
put_item "$today" "user-delete-deleting" "$status_deleting" \
  "FILTERED OUT: already in deleting status"
put_item "$today" "user-delete-suspended" "$status_permanently_suspended" \
  "FILTERED OUT: permanently suspended"
echo ""

# --- Edge case: records with a past date should NOT be picked up by any current run ---
echo "=== Edge case: past date (dateForDeletion = $yesterday) ==="
put_item "$yesterday" "user-past-pending" "pending" \
  "NOT QUERIED: date is in the past, won't match any calculateTargetDate()"
echo ""

echo "Done. Seeded $(echo 6+5+5+1 | bc) records into $TABLE_NAME."
