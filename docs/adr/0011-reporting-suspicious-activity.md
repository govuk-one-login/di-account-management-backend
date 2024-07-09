# Design for reporting suspicious activity

Establish a pattern for implementing workflows in a resilient and extendable way. The initial use case will be the report suspicious activity workflow.

## Context

We will allow the user to select one or more records from the activity log to report as suspicious activity. A suspicious activity report consists of a Zendesk ticket, a TxMA event and an email confirmation. All of these tasks must finish before a suspicious activity report is considered complete. Some of the tasks must happen serially and some can be run in parallel. All of the tasks must be resilient to error.

The required tasks are:

1. Update the activity log items to show report requested.
2. Create Zendesk ticket
3. Update the activity log items with the ticket number
4. Send an event to TxMA that includes the Zendesk ticket number
5. Update the activity log items with the TxMA event id
6. Send an email to Notify.
7. Update the activity log items with id of request to Nofify.

Notes.

- Step 1 allows the front end to redisplay the activity log with the status of the reported activity records shown correctly to prevent multiple reports of the same activity.
- Implicit in this process is a state machine showing the life cycle of reporting suspicious activity.
- Steps 1 and 2 must happen in sequence, the remaining steps can be executed in parallel.

## Decision

We will use Step Functions for the report suspicious activity workflow.

## Options Considered

### Option 1 - Lambda and SQS

This option utilises well understood services already in use by Home Team. A series of Lambdas would be connected via SQS queues to provide resilience.

Triggered by the frontend sending a message to a Report Suspicious SQS Queue meeting the non-blocking requirement.

#### Detailed flow

The Report Suspicious SQS queue is subscribed by a lambda that will update DynamoDB to record that the report is being processed.  
This will allow the user to return to the activity page and see that the report is underway. It will prevent them from reporting multiple times.

Once the initial state of the Report has been stored in DynamoDB the process to update all the back end systems can begin.

The Report Suspicious Lambda will publish the original event to a SQS queue - Handle Suspicious Activity Queue.

The Handle Suspicious Activity Queue is subscribed by the Create Zendesk Ticket Lambda. It will create a ticket in Zendesk using an HTTP call and then update DynamoDB with the ticket number.

Once the ticket is created the lambda will publish a new event that includes to the original event and the ticket id.

Multiple lambdas can listen for this event:

1. Lambda to send an audit event to TxMA. Once the event has been sent it will update DynamoDB with the TxMA event id.
2. Lambda to optionally send an email via Notify. Once the email has been sent, or rather requested to be sent, it will update DynamoDB with details from Notify.

In failure scenarios:

- The SQS visibility timeout on the queue will determine how long before the lambda can retry handling the event.
- The maxReceiveCount determines how many times the lambda can try to handle the event before its sent to a DLQ.

State machine would be modelled in DynamoDB. We could use multiple fields in each activity record to show where we are in the process. Having SQS separate the actions would mean we don't need to consult the state machine to determine what we can do next it would simply allow the front end to show where the process was up to.

### Option 2 - Step Functions

Define a Step Functions workflow that is activated by an event from SNS sent by the frontend and meeting the non-blocking requirement. The Step Functions workflow will perform the required actions in order and in a resilient fashion

#### Key features

- Resilience is provided by Step Functions, each step must complete before the last and will be retried.
- Tasks can be run in parrallel, meeting the requirement for sending events and emails as concurrently.
- Additional steps can easily be specified.
- Quick to define using a graphical workflow designer.
- StepFunctions can be defined in SAM templates.
- Resilience is a standard feature of Step Functions
- Easy to see the progress of the workflow.
- Built in debugging capability provides easier problem analysis.

Cost may be higher than lambdas. Example of 1000 workflows per month where each workflow has 10 state transitions would cost $0.15.

### Option 3 - single lambda

The whole process could be handled by a single lambda that picks up an event from SQS to decouple the front end. The lambda could either perform each step required in turn or run steps in parallel using async/await:

1. Update the database.
2. Create the ticket.
3. Store the ticket id in the database.
4. Publish a TxMa event.
5. Send an email via Notify.

The state machine for this approach would be in DynamoDB with fields storing the state of the request, the ticket id, the TxMA event id, any confirmation from Notify.

## Consequences

- We will use a single AWS service to define and manage the workflow.
- Interfaces with other AWS services can be achieved by configuration.
- This is a low code solution
- There will be a learning curve as Step Functions are new to the team
