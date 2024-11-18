import boto3
import time

# Initialize a session using CloudFormation
client = boto3.client('cloudformation')

# Name of the CloudFormation stack
stack_name = 'account-mgmt-backend'  # Replace with actual stack name

def call_describe_stack_events(stack_name):
    print("Describing call stack event")
    try:
        response = client.describe_stack_events(StackName=stack_name)
        print(f"Stack event response is: {response}")
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

if __name__ == "__main__":
    wait_for_stack_status(stack_name)
    print("Script execution completed.")
