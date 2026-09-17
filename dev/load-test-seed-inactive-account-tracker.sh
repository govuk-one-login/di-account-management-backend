#!/usr/bin/env bash
# Bulk-seeds the inactive_account_tracker_store DynamoDB table with a
# user-specified number of fake tracker records for IAD load testing (OLH-5189).
#
# All records share a single dateForDeletion (today + --days) so they are picked
# up together by the query-and-dispatch process, and use @test.null.local email
# addresses so the notification path exercises end-to-end WITHOUT sending real
# email via Notify (the domain is intentionally undeliverable).
#
# Records are written with:
#   status: pending          -> in allowedStatuses for all three processes
#   hasSetupMfa: true         -> NOT skipped by the hasNotSetupMfa guard
#   emailAddress: ...@test.null.local
#
# Usage:
#   ./dev/load-test-seed-inactive-account-tracker.sh --count 46000 --days 30 --profile <aws-profile>
#   ./dev/load-test-seed-inactive-account-tracker.sh --count 46000 --days 0  --profile <aws-profile>
#
# Options:
#   --count <n>        Number of records to create (required)
#   --days <n>         Days from today for dateForDeletion (default: 0 = deleted today)
#   --table-name <s>   DynamoDB table name (default: inactive_account_tracker_store)
#   --profile <s>      AWS CLI profile
#   --region <s>       AWS region (default: eu-west-2)
#   --prefix <s>       commonSubjectId prefix (default: loadtest) - lets you
#                      distinguish/clean up a batch later
#   --parallel <n>     Concurrent batch-write requests (default: 8)
#   --dry-run          Build and count items but do not write to DynamoDB

set -euo pipefail

COUNT=""
DAYS=0
TABLE_NAME="inactive_account_tracker_store"
REGION="eu-west-2"
PROFILE_ARG=""
PREFIX="loadtest"
PARALLEL=8
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case $1 in
  --count)
    COUNT="$2"
    shift 2
    ;;
  --days)
    DAYS="$2"
    shift 2
    ;;
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
  --prefix)
    PREFIX="$2"
    shift 2
    ;;
  --parallel)
    PARALLEL="$2"
    shift 2
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  *)
    echo "Unknown arg: $1" >&2
    exit 1
    ;;
  esac
done

if [[ -z "$COUNT" ]]; then
  echo "Error: --count <n> is required" >&2
  exit 1
fi
if ! [[ "$COUNT" =~ ^[0-9]+$ ]] || [[ "$COUNT" -lt 1 ]]; then
  echo "Error: --count must be a positive integer, got: $COUNT" >&2
  exit 1
fi
if ! [[ "$DAYS" =~ ^-?[0-9]+$ ]]; then
  echo "Error: --days must be an integer, got: $DAYS" >&2
  exit 1
fi

# DynamoDB BatchWriteItem hard limit is 25 items per request.
BATCH_SIZE=25

# dateForDeletion = today + DAYS (UTC), format YYYY-MM-DD.
if date -u -v+"${DAYS}"d +%Y-%m-%d >/dev/null 2>&1; then
  DATE_FOR_DELETION=$(date -u -v+"${DAYS}"d +%Y-%m-%d) # BSD/macOS date
else
  DATE_FOR_DELETION=$(date -u -d "${DAYS} days" +%Y-%m-%d) # GNU date
fi

NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
RUN_ID=$(date -u +%Y%m%d%H%M%S)

echo "=============================================="
echo "IAD load-test seed"
echo "  Table:            $TABLE_NAME"
echo "  Region:           $REGION"
echo "  Records:          $COUNT"
echo "  dateForDeletion:  $DATE_FOR_DELETION (today + ${DAYS}d)"
echo "  commonSubjectId:  ${PREFIX}-${RUN_ID}-<n>"
echo "  emailAddress:     ${PREFIX}-<n>-${RUN_ID}@test.null.local"
echo "  Batch size:       $BATCH_SIZE"
echo "  Parallelism:      $PARALLEL"
echo "  Dry run:          $DRY_RUN"
echo "=============================================="
echo ""

WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/iad-loadtest.XXXXXX")
trap 'rm -rf "$WORK_DIR"' EXIT

# Build one request-items JSON file per batch of up to BATCH_SIZE records.
build_batch_file() {
  local start="$1" end="$2" file="$3"
  {
    printf '{"%s":[' "$TABLE_NAME"
    local first=true
    local i
    for ((i = start; i < end; i++)); do
      local csid="${PREFIX}-${RUN_ID}-${i}"
      local email="${PREFIX}-${i}-${RUN_ID}@test.null.local"
      if [[ "$first" == true ]]; then first=false; else printf ','; fi
      printf '{"PutRequest":{"Item":{'
      printf '"dateForDeletion":{"S":"%s"},' "$DATE_FOR_DELETION"
      printf '"commonSubjectId":{"S":"%s"},' "$csid"
      printf '"publicSubjectId":{"S":"public-%s"},' "$csid"
      printf '"status":{"S":"pending"},'
      printf '"statusLastUpdated":{"S":"%s"},' "$NOW"
      printf '"userLastActive":{"S":"%s"},' "$NOW"
      printf '"userLastActiveSource":{"S":"LOAD_TEST"},'
      printf '"userLastActiveUpdated":{"S":"%s"},' "$NOW"
      printf '"emailAddress":{"S":"%s"},' "$email"
      printf '"emailAddressSource":{"S":"LOAD_TEST"},'
      printf '"emailAddressLastUpdated":{"S":"%s"},' "$NOW"
      printf '"hasSetupMfa":{"BOOL":true}'
      printf '}}}'
    done
    printf ']}'
  } >"$file"
}

# Send one batch file, retrying UnprocessedItems with exponential backoff.
send_batch() {
  local file="$1"
  local attempt=0
  local max_attempts=8
  local current="$file"

  while :; do
    local out
    out=$(aws dynamodb batch-write-item \
      $PROFILE_ARG --region "$REGION" \
      --request-items "file://$current" \
      --output json 2>&1) || {
      echo "  batch-write-item failed: $out" >&2
      return 1
    }

    # Any unprocessed items to retry?
    local unprocessed
    unprocessed=$(printf '%s' "$out" |
      python3 -c 'import sys,json; d=json.load(sys.stdin); u=d.get("UnprocessedItems") or {}; print(json.dumps(u) if u else "")' 2>/dev/null || echo "")

    if [[ -z "$unprocessed" ]]; then
      return 0
    fi

    attempt=$((attempt + 1))
    if [[ "$attempt" -ge "$max_attempts" ]]; then
      echo "  Gave up on unprocessed items after $max_attempts attempts" >&2
      return 1
    fi
    current="${file}.retry"
    printf '%s' "$unprocessed" >"$current"
    sleep "$(awk "BEGIN{print 0.2 * 2 ^ ($attempt - 1)}")"
  done
}

# Generate all batch files first.
NUM_BATCHES=0
for ((start = 0; start < COUNT; start += BATCH_SIZE)); do
  end=$((start + BATCH_SIZE))
  if [[ "$end" -gt "$COUNT" ]]; then end="$COUNT"; fi
  build_batch_file "$start" "$end" "$WORK_DIR/batch-$(printf '%08d' "$NUM_BATCHES").json"
  NUM_BATCHES=$((NUM_BATCHES + 1))
done
echo "Prepared $NUM_BATCHES batch file(s) for $COUNT records."

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run: no data written. Sample batch file:"
  head -c 800 "$WORK_DIR/batch-00000000.json"
  echo ""
  echo "..."
  exit 0
fi

echo "Writing to DynamoDB (parallelism $PARALLEL)..."
export -f send_batch
export PROFILE_ARG REGION

# Dispatch batches with bounded parallelism.
inflight=0
failed=0
for f in "$WORK_DIR"/batch-*.json; do
  send_batch "$f" || failed=$((failed + 1)) &
  inflight=$((inflight + 1))
  if [[ "$inflight" -ge "$PARALLEL" ]]; then
    wait -n 2>/dev/null || wait
    inflight=$((inflight - 1))
  fi
done
wait

if [[ "$failed" -gt 0 ]]; then
  echo "WARNING: $failed batch(es) reported failure. Re-run to top up or investigate." >&2
  exit 1
fi

echo ""
echo "Done. Seeded $COUNT records into $TABLE_NAME for dateForDeletion=$DATE_FOR_DELETION."
echo "Run id: $RUN_ID (commonSubjectId prefix: ${PREFIX}-${RUN_ID}-)"
