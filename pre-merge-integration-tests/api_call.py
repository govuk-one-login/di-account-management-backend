import time
import boto3
import os
from botocore.exceptions import ClientError

client = boto3.client('cloudformation')
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

stack_name = 'home-backend'
table_name = 'activity_log'
event_id = '75093b9c-728d-4c7f-aad2-7e5892a30be0'
user_id = 'user_id'
message_body = ("{ \"event_name\" : \"AUTH_AUTH_CODE_ISSUED\", \"event_id\" : "
                "\"75093b9c-728d-4c7f-aad2-7e5892a30be0\", \"user\" : { \"user_id\" : \"user_id\", \"session_id\" : "
                "\"7340477f-74da-46d4-9400-d22ae518da3a\" }, \"client_id\" : \"vehicleOperatorLicense\" , "
                "\"timestamp\" : 1730800548523 }")
queue_name = os.getenv('SQS_QUEUE_ARN')


def send_message_to_queue(message_attributes=None):
    print(f"Queue ARN is: {queue_name}")
    print(f"Message body  is: {message_body}")
    try:
        # Send message to SQS queue
        response = sqs.send_message(
            QueueUrl=queue_name,
            MessageBody=message_body,
            MessageAttributes=message_attributes or {}
        )

        print("Message sent! Message ID:", response['MessageId'])
    except Exception as e:
        print("Error sending message:", str(e))


def check_activity_log_created():
    delay = 1
    retries = 10

    for attempt in range(1, retries + 1):
        print(f"Attempt {attempt}...")
        response = call_get_activity_log()
        if response is not None:
            print(f"Successfully retrieved event: {response}")
            return response
        print(f"Failed to retrieve event. Retrying in {delay} seconds...")
        time.sleep(delay)

    print("Max attempts reached or get activity log within the attempts limit.")
    raise Exception(" Max attempts reached or get activity log within the attempts limit.")


def call_get_activity_log():
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


def delete_activity_log():
    print(f"Attempting to delete activity log for event_id {event_id} and user_id {user_id}")
    table = dynamodb.Table(table_name)
    try:
        response = table.delete_item(
            Key={
                'event_id': event_id,
                'user_id': user_id
            }
        )
        print(f"Deleted item with event_id={event_id} and user_id={user_id}")
        return response

    except ClientError as e:
        print(f"Error deleting activity log: {e.response['Error']['Message']}")
        raise


def teardown():
    delete_activity_log()


def setup():
    delete_activity_log()


if __name__ == "__main__":
    setup()
    send_message_to_queue()
    check_activity_log_created()
    teardown()
    print("Script execution completed successfully.")
