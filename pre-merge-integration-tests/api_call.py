import boto3
import time
import sys

# Initialize a session using CloudFormation
client = boto3.client('cloudformation')
# Create SQS client
sqs = boto3.client('sqs')

# Name of the CloudFormation stack
stack_name = 'home-backend'  # Replace with actual stack name
queue_url = "https://sqs.<region>.amazonaws.com/<account_id>/<queue_name>"
message_body = "{ \"event_name\" : { \"S\" : \"AUTH_AUTH_CODE_ISSUED\" }, \"event_id\" : { \"S\" : \"65093b9c-728d-4c7f-aad2-7e5892a30be0\" }, \"user\" : { \"M\" : { \"user_id\" : { \"S\" : \"pre_merge_user_id\" }, \"session_id\" : { \"S\" : \"7340477f-74da-46d4-9400-d22ae518da3a\" } } }, \"client_id\" : { \"S\" : \"vehicleOperatorLicense\" }, \"timestamp\" : { \"N\" : \"1730800548523\" } }"

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
    # wait for 500ms,
    # attempt to get activity log from table with id
    # retry for up to 10 times before giving up, throw an error is no activity log
    #otherwise report success and continue
    print("Script execution completed.")
