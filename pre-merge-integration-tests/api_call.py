import boto3
import time
import sys
from botocore.exceptions import ClientError

# Initialize a session using CloudFormation
client = boto3.client('cloudformation')
# Create SQS client
sqs = boto3.client('sqs')
# Initialize the DynamoDB client
dynamodb = boto3.resource('dynamodb')


# Name of the CloudFormation stack
stack_name = 'home-backend'
message_body = "{ \"event_name\" : \"AUTH_AUTH_CODE_ISSUED\", \"event_id\" : \"75093b9c-728d-4c7f-aad2-7e5892a30be0\", \"user\" : { \"user_id\" : \"user_id\", \"session_id\" : \"7340477f-74da-46d4-9400-d22ae518da3a\" }, \"client_id\" : \"vehicleOperatorLicense\" , \"timestamp\" : \"1730800548523\" }"

def send_message_to_queue(queue_url, message_body, message_attributes=None):

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


def call_describe_stack_events(stack_name):
    print("Describing call stack event")
    try:
        response = client.describe_stack_events(StackName=stack_name)
        return response
    except Exception as e:
        print(f"Error fetching stack events: {e}")
        return None

def check_stack_status(events):
    print("Checking stack status")
    create_in_progress = False
    update_complete = False
    create_complete = False
    
    for event in events:
        resource_status = event['ResourceStatus']
        if resource_status == 'CREATE_IN_PROGRESS':
            create_in_progress = True
        if resource_status == 'UPDATE_COMPLETE':
            update_complete = True
        if resource_status == 'CREATE_COMPLETE':
            create_complete = True
    
    return create_in_progress, update_complete, create_complete

def wait_for_stack_status(stack_name, max_attempts=10):
    print(f"Waiting for stack {stack_name} to reach CREATE_IN_PROGRESS, CREATE_COMPLETE, or UPDATE_COMPLETE status...")
    attempts = 0
    while attempts < max_attempts:
        response = call_describe_stack_events(stack_name)
        if not response:
            print("No response received.")
            break
        
        events = response['StackEvents']
        num_events = len(events)

        for i in range(0, num_events, 10):
            batch_events = events[i:i + 10]
            create_in_progress, update_complete, create_complete = check_stack_status(batch_events)

            if create_in_progress:
                print("Stack is in CREATE_IN_PROGRESS status.")
            if update_complete:
                print(f"Stack update complete for stack {stack_name}.")
                return
            if create_complete:
                print(f"Stack creation complete for stack {stack_name}.")
                return

        attempts += 1
        print(f"Attempt {attempts}/{max_attempts}: Waiting for stack to reach desired status...")
        time.sleep(2)

    print("Max attempts reached or desired status not found within the attempts limit.")

def check_activity_log_created(event_id, user_id, max_attempts=10):
    print(f"Checking activity log created with event_id {event_id}")
    attempts = 0
    while attempts < max_attempts:
        response = call_get_activity_log(event_id, user_id)
        if response is not None:
            print(f"Successfully retrieved event: {response}")
            return response
        print(f"Failed to retrieve item. Retrying in {delay} seconds...")
        time.sleep(2)
        attempts += 1
        print(f"Attempt {attempts}/{max_attempts}: Waiting for get activity log...")

    print("Max attempts reached or get activity log within the attempts limit.")
    return None

def call_get_activity_log(event_id, user_id):
    print(f"Attempting to get activity log for event_id {event_id}")
    table_name = 'activity_log'
    table = dynamodb.Table(table_name)
    try:
        response = table.query(
            KeyConditionExpression=boto3.dynamodb.conditions.Key('user_id').eq(user_id) &
            boto3.dynamodb.conditions.Key('event_id').eq(event_id)
        )
        # Get the items
        items = response.get('Items', [])
        print(f"Found {len(items)} items:")
        return items[0]

    except ClientError as e:
        print(f"Error fetching item: {e.response['Error']['Message']}")

def main(args):
    if len(args) < 2:
        print("Usage: api_call.py <param1>")
        return

    queue_url = args[1]  # First parameter

    print(f"Queue URL is: {queue_url}")
    send_message_to_queue(queue_url, message_body)

if __name__ == "__main__":
    wait_for_stack_status(stack_name)
    main(sys.argv)
    check_activity_log_created('75093b9c-728d-4c7f-aad2-7e5892a30be0', 'user_id')
    print("Script execution completed.")
