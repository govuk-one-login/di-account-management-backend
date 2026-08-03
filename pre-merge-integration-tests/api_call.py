import time
import json
import uuid
import threading
import boto3
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from botocore.exceptions import ClientError
from boto3.dynamodb.conditions import Key

sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

# Note: env var is named SQS_QUEUE_ARN but contains a Queue URL (pre-existing CI config)
QUEUE_URL = os.getenv('SQS_QUEUE_ARN')
ACTIVITY_LOG_TABLE = 'activity_log'
USER_SERVICES_TABLE = 'user_services'
INACTIVE_ACCOUNT_TRACKER_TABLE = 'inactive_account_tracker_store'


# --- Logging ---

def log(test_id, message):
    print(f"  [{test_id}] {message}")


# --- Helpers ---

def generate_user_id(test_name):
    short_uuid = str(uuid.uuid4())[:8]
    return f"premerge-{test_name}-{short_uuid}"


def generate_event_id():
    return str(uuid.uuid4())


def send_message(queue_url, body, test_id=""):
    message_body = json.dumps(body) if isinstance(body, dict) else body
    log(test_id, "Sending message to queue")
    try:
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=message_body,
        )
        log(test_id, f"Message sent with ID: {response['MessageId']}")
        return response
    except Exception as e:
        log(test_id, f"Error sending message: {str(e)}")
        raise


def poll_for_item(table_name, key_condition, index_name=None, timeout=30, test_id=""):
    delay = 1
    max_attempts = int(timeout / delay)
    table = dynamodb.Table(table_name)

    for attempt in range(1, max_attempts + 1):
        log(test_id, f"Polling {table_name} (attempt {attempt}/{max_attempts})...")
        try:
            query_params = {
                'KeyConditionExpression': key_condition,
            }
            if index_name:
                query_params['IndexName'] = index_name

            response = table.query(**query_params)
            items = response.get('Items', [])
            if items:
                log(test_id, f"Found {len(items)} item(s)")
                return items[0]
        except ClientError as e:
            log(test_id, f"Query error: {e.response['Error']['Message']}")

        time.sleep(delay)

    return None


def assert_item_exists(table_name, key_condition, index_name=None, timeout=30, description="item", test_id=""):
    item = poll_for_item(table_name, key_condition, index_name=index_name, timeout=timeout, test_id=test_id)
    if item is None:
        raise AssertionError(f"Expected {description} in {table_name} but not found after {timeout}s")
    return item


# The wait time assumes max Lambda processing time is under 10s.
# If the architecture changes (e.g. Step Functions), this may need increasing.
def assert_no_item(table_name, key_condition, index_name=None, wait=10, description="item", test_id=""):
    log(test_id, f"Waiting {wait}s before checking absence of {description}...")
    time.sleep(wait)
    table = dynamodb.Table(table_name)
    try:
        query_params = {
            'KeyConditionExpression': key_condition,
        }
        if index_name:
            query_params['IndexName'] = index_name

        response = table.query(**query_params)
        items = response.get('Items', [])
        if items:
            raise AssertionError(
                f"Expected no {description} in {table_name} but found {len(items)} item(s): {items[0]}"
            )
        log(test_id, f"Confirmed: no {description} found")
    except ClientError as e:
        log(test_id, f"Query error during assert_no_item: {e.response['Error']['Message']}")
        raise


def delete_item(table_name, key, test_id=""):
    table = dynamodb.Table(table_name)
    try:
        table.delete_item(Key=key)
        log(test_id, f"Deleted from {table_name}: {key}")
    except ClientError as e:
        log(test_id, f"Warning: error deleting from {table_name}: {e.response['Error']['Message']}")


def delete_items_by_index(table_name, key_condition, index_name, key_fields, test_id=""):
    table = dynamodb.Table(table_name)
    try:
        response = table.query(
            IndexName=index_name,
            KeyConditionExpression=key_condition,
        )
        for item in response.get('Items', []):
            key = {field: item[field] for field in key_fields if field in item}
            table.delete_item(Key=key)
            log(test_id, f"Deleted from {table_name}: {key}")
    except ClientError as e:
        log(test_id, f"Warning: error during cleanup of {table_name}: {e.response['Error']['Message']}")


# --- Test Runner ---

class TestResults:
    def __init__(self):
        self.passed = []
        self.failed = []
        self._lock = threading.Lock()

    def record_pass(self, name, duration):
        with self._lock:
            self.passed.append((name, duration))

    def record_fail(self, name, duration, error):
        with self._lock:
            self.failed.append((name, duration, error))

    def summary(self):
        total = len(self.passed) + len(self.failed)
        separator = "=" * 60
        print("\n" + separator)
        print(f"TEST RESULTS: {len(self.passed)}/{total} passed")
        print(separator)
        if self.passed:
            print("\nPassed:")
            for name, duration in self.passed:
                print(f"  PASS {name} ({duration:.1f}s)")
        if self.failed:
            print("\nFailed:")
            for name, duration, error in self.failed:
                print(f"  FAIL {name} ({duration:.1f}s)")
                print(f"    Error: {error}")
        print()
        return len(self.failed) == 0


def run_test(name, fn, results):
    test_id = name
    log(test_id, "STARTED")
    start = time.time()
    try:
        fn(test_id)
        duration = time.time() - start
        results.record_pass(name, duration)
        log(test_id, f"PASS ({duration:.1f}s)")
    except Exception as e:
        duration = time.time() - start
        results.record_fail(name, duration, str(e))
        log(test_id, f"FAIL ({duration:.1f}s): {e}")


def run_tests_parallel(test_cases, results, max_workers=5):
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(run_test, name, fn, results): name
            for name, fn in test_cases
        }
        for future in as_completed(futures):
            future.result()


# --- Tests ---

def test_auth_code_issued_creates_activity_log(test_id):
    user_id = generate_user_id("auth-code-issued")
    event_id = generate_event_id()
    client_id = "vehicleOperatorLicense"
    timestamp = 1730800548523

    table = dynamodb.Table(USER_SERVICES_TABLE)
    table.put_item(Item={
        "user_id": user_id,
        "services": [
            {
                "client_id": client_id,
                "count_successful_logins": 463905,
                "last_accessed": timestamp,
                "last_accessed_pretty": "5 November 2024"
            }
        ]
    })

    try:
        send_message(QUEUE_URL, {
            "event_name": "AUTH_AUTH_CODE_ISSUED",
            "event_id": event_id,
            "user": {
                "user_id": user_id,
                "session_id": "7340477f-74da-46d4-9400-d22ae518da3a"
            },
            "client_id": client_id,
            "timestamp": timestamp,
        }, test_id=test_id)

        assert_item_exists(
            ACTIVITY_LOG_TABLE,
            Key('user_id').eq(user_id) & Key('event_id').eq(event_id),
            timeout=30,
            description=f"activity log for user {user_id}",
            test_id=test_id,
        )
    finally:
        delete_item(ACTIVITY_LOG_TABLE, {'event_id': event_id, 'user_id': user_id}, test_id=test_id)
        delete_item(USER_SERVICES_TABLE, {'user_id': user_id}, test_id=test_id)


def test_unknown_event_is_silently_dropped(test_id):
    """An event with an unrecognised event_name should not produce any
    downstream records."""
    user_id = generate_user_id("unknown-event")
    event_id = generate_event_id()

    send_message(QUEUE_URL, {
        "event_name": "FABRICATED_EVENT_NAME",
        "event_id": event_id,
        "user": {
            "user_id": user_id,
            "session_id": "7340477f-74da-46d4-9400-d22ae518da3a"
        },
        "client_id": "vehicleOperatorLicense",
        "timestamp": 1730800548523,
    }, test_id=test_id)

    assert_no_item(
        ACTIVITY_LOG_TABLE,
        Key('user_id').eq(user_id) & Key('event_id').eq(event_id),
        description=f"activity log for unknown event user {user_id}",
        test_id=test_id,
    )


# --- Main ---

if __name__ == "__main__":
    if not QUEUE_URL:
        print("ERROR: SQS_QUEUE_ARN environment variable is not set")
        sys.exit(1)

    print(f"Queue URL: {QUEUE_URL}")
    print("Starting pre-merge integration tests (parallel)...")

    results = TestResults()

    test_cases = [
        ("auth-code-issued", test_auth_code_issued_creates_activity_log),
        ("unknown-event-dropped", test_unknown_event_is_silently_dropped),
    ]

    run_tests_parallel(test_cases, results)

    all_passed = results.summary()
    sys.exit(0 if all_passed else 1)
