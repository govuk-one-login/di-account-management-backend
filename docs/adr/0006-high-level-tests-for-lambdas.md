# High level test strategy for Lambdas

## Summary

- Will will ensure functionality and protect against regressions with a good coverage of automated unit tests on lambdas.
- We will protect the greater integrity of the system with automated higher level tests to ensure config and the system level unit works.
- We will do this by {@TODO}

## Context

## Decision

TBC

### Diagram

## Other options considered

### Choosing not to test

Rely on async, good serverlss principles
Trust your config
Things will be OK.

Not enough protection against mucking up the config somehow.
I was reassurance we work across the piece, and the components have integrated correctly.

### Use EventBridge

What you can do with EventBridge is set it up to listen for an event on stack e.g. `CREATE_COMPLETE` or `UPDATE_COMPLETE` and then you can tell the event to trigger a lambda function within that stack.

This is [the Stack Status Event Schema](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/eventbridge-events.html#schema-stack-status-event)

So, for example, you could:

1. on update of a stack
1. trigger an EventBridge event
1. that runs a lambda function in that stack
1. that generates a test stack for that stack
1. that stack also publishes to EventBridge
1. that triggers a lambda function in the test stack
   - runs all the "tests" (whatever they are)
1. these are all events so they are handled via something like EventBridge again
1. On completion of the test stack, it creates a new event to delete the test stack
1. it triggers a lambda function to delete the test stack\

This requires two functions and two events in the main stack: create test stack, delete test stack, and associated events. The lambda functions then are there to run cloudformation (or it could just be a Lambda function if it is simple) and you can trigger this of the EventBridge when the stack is updated.

### Having a test lambdas write and read events

Basically what we're talking about with event bridge less fancy.
Event bridge comes out better by comparison, as we're testing a separate stack, not risking running this against a "real" stack.

## Useful reading in making this decision

- [A Cloud Guru - The serverless approach to testing is different and may actually be easier](https://acloudguru.com/blog/engineering/testing-and-the-serverless-approach)
- [Martin Fowler - Testing Strategies in a Microservice Architecture](https://martinfowler.com/articles/microservice-testing/)
- [AWS - Getting started with testing serverless applications](https://aws.amazon.com/blogs/compute/getting-started-with-testing-serverless-applications/)
- [AWS - Stefan Smith - Testing Serverless Applications](https://govukverify.atlassian.net/jira/software/c/projects/GUA/boards/195?modal=detail&selectedIssue=GUA-430) - NB Link to private copy on GOV.UK One Login Jira (cannot find public web link!)

## Consequences

-
