import boto3
import time
import os

# Initialize a session using SQS
sqs_client = boto3.client('sqs')
dynamodb_client = boto3.client('dynamodb')



# Name of the SQS Queue
queue_name = os.environ('SQS_QUEUE_ARN')
dynamodb_table = os.environ('DYNAMODB_TABLE')

def push_message_to_sqs():
    return

def read_from_dynamodb():
    return

def teardown():
    return

if __name__ == "__main__":
    #could invoke stuff above
    print("Script execution completed.")
