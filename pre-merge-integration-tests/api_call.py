import time
import boto3
import os
from botocore.exceptions import ClientError

client = boto3.client('cloudformation')
sqs = boto3.client('sqs')
dynamodb = boto3.resource('dynamodb')

stack_name = 'home-backend'
activity_log_table_name = 'activity_log'
user_services_table_name = 'user_services'
event_id = '75093b9c-728d-4c7f-aad2-7e5892a30be0'
premerge_user_id = 'premerge_user_id'
message_body = ("{ \"event_name\" : \"AUTH_AUTH_CODE_ISSUED\", \"event_id\" : "
                "\"75093b9c-728d-4c7f-aad2-7e5892a30be0\", \"user\" : { \"user_id\" : \"premerge_user_id\", \"session_id\" : "
                "\"7340477f-74da-46d4-9400-d22ae518da3a\" }, \"client_id\" : \"vehicleOperatorLicense\" , "
                "\"timestamp\" : 1730800548523 }")
queue_name = os.getenv('SQS_QUEUE_ARN')


def send_message_to_queue(message_attributes=None):
    print(f"Queue ARN is: {queue_name}")
    print(f"Message body is: {message_body}")
    try:
        # Send message to SQS queue
        response = sqs.send_message(
            QueueUrl=queue_name,
            MessageBody=message_body,
            MessageAttributes=message_attributes or {}
        )

        print("Message sent with Message ID:", response['MessageId'])
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
    print(f"Attempting to get activity log for event_id {event_id} and user_id {premerge_user_id}")
    table = dynamodb.Table(activity_log_table_name)
    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(premerge_user_id) &
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
    print(f"Attempting to delete activity log for event_id {event_id} and user_id {premerge_user_id}")
    table = dynamodb.Table(activity_log_table_name)
    try:
        response = table.delete_item(
            Key={
                'event_id': event_id,
                'user_id': premerge_user_id
            }
        )
        print(f"Deleted item with event_id={event_id} and user_id={premerge_user_id}")
        return response

    except ClientError as e:
        print(f"Error deleting activity log: {e.response['Error']['Message']}")
        raise


def create_user_services_entry():
    print(f"Attempting to add_user_services_entry for user {premerge_user_id}")
    table = dynamodb.Table(user_services_table_name)
    user_services_entry = {
        "user_id": premerge_user_id,
        "services": [
            {
                "client_id": "vehicleOperatorLicense",
                "count_successful_logins": 463905,
                "last_accessed": 1730800548523,
                "last_accessed_pretty": "5 November 2024"
            }
        ]
    }
    try:
        response = table.put_item(Item=user_services_entry)
        print(f"Added new user services entry with id ={premerge_user_id}")
        return response

    except ClientError as e:
        print(f"Error adding new user services entry: {e.response['Error']['Message']}")
        raise


def delete_user_services_entry():
    print(f"Attempting to deleted user_services_entry for user_id with id {premerge_user_id}")
    table = dynamodb.Table(user_services_table_name)
    try:
        response = table.delete_item(
            Key={
                "user_id": premerge_user_id
            }
        )
        print(f"Deleted user with user_id={premerge_user_id}")
        return response

    except ClientError as e:
        print(f"Error deleting activity log: {e.response['Error']['Message']}")
        raise


def teardown():
    delete_activity_log()
    delete_user_services_entry()


def setup():
    delete_user_services_entry()
    create_user_services_entry()
    delete_activity_log()


if __name__ == "__main__":
    setup()
    send_message_to_queue()
    check_activity_log_created()
    teardown()
    print("Script execution completed successfully.")
