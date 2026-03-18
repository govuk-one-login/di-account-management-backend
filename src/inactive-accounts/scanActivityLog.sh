#!/bin/bash

TABLE_NAME=""
EVNIRONMENT=""
TOTAL_SEGMENTS=5
CONCURRENCY=5

while [[ "$#" -gt 0 ]]; do
    case $1 in
        -t|--table-name) TABLE_NAME="$2"; shift ;;
        -e|--environment) ENVIRONMENT="$2"; shift ;;
        -s|--total-segments) TOTAL_SEGMENTS="$2"; shift ;;
        -c|--concurrency) CONCURRENCY="$2"; shift ;;
        -h|--help) 
            echo "Usage: $0 -t <table_name> -e <environment> [-s <total_segments>] [-g <segment>] [-c <concurrency>]"
            exit 0
            ;;
        *) 
            echo "Unknown parameter passed: $1"
            exit 1
            ;;
    esac
    shift
done

CHECKPOINT_DIRECTORY="./checkpoints"
RESULTS_DIRECTORY="./results"

if [[ -z "$TABLE_NAME" ]] || [[ -z "$ENVIRONMENT" ]]; then
    echo "Table name and environment are required."
    echo "Usage: $0 -t <table_name> -e <environment> [-s <total_segments>] [-g <segment>] [-c <concurrency>]"
    exit 1
fi

mkdir -p "$CHECKPOINT_DIRECTORY" "$RESULTS_DIRECTORY"

scan_segment() {
    local segment=$1
    local checkpoint_file="$CHECKPOINT_DIRECTORY/checkpoint_segment_$segment.txt"
    local result_file="$RESULTS_DIRECTORY/result_segment_$segment.jsonl"

    echo "Scanning segment $segment of $TOTAL_SEGMENTS..."

    local token_arg=""
    if [[ -f "$checkpoint_file" ]] && [[ -s "$checkpoint_file" ]]; then
        token_arg="--starting-token $(cat $checkpoint_file)"
    fi

    local temp_segment_file="$RESULTS_DIRECTORY/temp_segment_$segment.jsonl"

    aws dynamodb scan \
        --table-name "$TABLE_NAME" \
        --segment "$segment" \
        --total-segments "$TOTAL_SEGMENTS" \
        $token_arg \
        --output json > "$temp_segment_file"

    jq -r '.Items[].user_id.S' "$temp_segment_file" >> "$result_file"

    local lastKey=$(jq '.LastEvaluatedKey' $temp_segment_file)
    if [[ "$lastKey" == "null" ]] || [[ -z "$lastKey" ]]; then
        rm -f "$checkpoint_file"
        echo "Segment $segment completed."
        return
    else 
        echo "$lastKey" > "$checkpoint_file"
        echo "Segment $segment checkpoint updated."
    fi
}

export -f scan_segment

export TABLE_NAME TOTAL_SEGMENTS CHECKPOINT_DIRECTORY RESULTS_DIRECTORY

seq 0 $((TOTAL_SEGMENTS - 1)) | xargs -P "$CONCURRENCY" -I {} bash -c "scan_segment {} \"$TABLE_NAME\" \"$TOTAL_SEGMENTS\""

cat "$RESULTS_DIRECTORY"/result_segment_*.jsonl | sort | uniq -c | sort -nr > "$RESULTS_DIRECTORY/{$TABLE_NAME}_{$ENVIRONMENT}_user_ids.txt"
echo "Scan completed. Results are in $RESULTS_DIRECTORY/{$TABLE_NAME}_{$ENVIRONMENT}_user_ids.txt"