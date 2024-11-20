import time
import boto3
import os
from botocore.exceptions import ClientError

client = boto3.client('cloudformation')
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

stack_name = 'home-backend'
message_body = ("{ \"event_name\" : \"AUTH_AUTH_CODE_ISSUED\", \"event_id\" : "
                "\"75093b9c-728d-4c7f-aad2-7e5892a30be0\", \"user\" : { \"user_id\" : \"user_id\", \"session_id\" : "
                "\"7340477f-74da-46d4-9400-d22ae518da3a\" }, \"client_id\" : \"vehicleOperatorLicense\" , "
                "\"timestamp\" : \"1730800548523\" }")
table_name = 'activity_log'
queue_name = os.environ('SQS_QUEUE_ARN')


def send_message_to_queue(queue_url, message_attributes=None):
    print(f"Message body is: {message_body}")
    try:
        # Send message to SQS queue
        response = sqs.send_message(
            QueueUrl=queue_url,
            MessageBody=message_body,
            MessageAttributes=message_attributes or {}
        )

        print("Message sent! Message ID:", response['MessageId'])
    except Exception as e:
        print("Error sending message:", str(e))


def check_activity_log_created(event_id, user_id):
    delay = 1
    retries = 10

    for attempt in range(1, retries + 1):
        print(f"Attempt {attempt}...")
        response = call_get_activity_log(event_id, user_id)
        if response is not None:
            print(f"Successfully retrieved event: {response}")
            return response
        print(f"Failed to retrieve event. Retrying in {delay} seconds...")
        time.sleep(delay)

    print("Max attempts reached or get activity log within the attempts limit.")
    raise Exception("Max attempts reached or get activity log within the attempts limit.")


def call_get_activity_log(event_id, user_id):
    print(f"Attempting to get activity log for event_id {event_id} and user_id {user_id}")
    table = dynamodb.Table(table_name)
    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id) &
                                   boto3.dynamodb.conditions.Key('event_id').eq(event_id)
        )
        # Get the items
        items = response.get('Items', [])
        print(f"Found {len(items)} items:")
        if items:
            return items[0]
        return None

    except ClientError as e:
        print(f"Error querying activity log: {e.response['Error']['Message']}")


def teardown():
    return


def setup():
    return


if __name__ == "__main__":
    send_message_to_queue(queue_name)
    setup()
    check_activity_log_created('75093b9c-728d-4c7f-aad2-7e5892a30be1', 'user_id')
    print("Script execution completed.")
    teardown()
    # teardown
