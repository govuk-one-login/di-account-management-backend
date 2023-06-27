# Architecture for stub services

## Context

We will be running performance (load) testing to see how our service scales.
As part of this, we need to replace external dependencies with stubs.
These stubs will be simple interfaces to replace eg. the Account Management API.

They'll need to scale well so they're not a limiting factor when load testing.
They should also be fast to develop and use AWS tools we're already familiar with.
We'll deploy the stubs through secure pipelines with our other components.

## Decision

We will use API gateway for our stub services with either mock integrations or Lambda as a backend, depending on the complexity of the stub.

Architectures we considered:

### API Gateway mock integrations

We could use [API Gateway mock integrations](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-mock-integration.html) to return static content or simple templates directly from API Gateway without any further backing services.
This would be very fast to develop, quick to deploy, and scale to support large amounts of traffic without needing configuration.
However, it may not be an appropriate choice for more complicated stubs which use other AWS services eg. KMS.

### API Gateway and Lambda

We could use API gateway backed by Lambda functions to generate responses.
We're already used to working with Lambda and this is how the programme builds production APIs.

This solution would also scale well and be fast to develop.
It also allows us to build stubs which use other AWS services or have a more complex response than with mock integrations.

### ImposterJS on Lambda

Other teams have used [Imposter](https://github.com/outofcoffee/imposter/blob/main/docs/run_imposter_aws_lambda.md) on Lambda to build their stubs.
This is a new tool to the team so would need some time to learn before it sped up development.
It may also be tricky to deploy through the secure build pipelines.

### Node app on Fargate

We could build API apps using Node & Express in a container deployed to ECS Fargate.
We're already familiar with this setup from working on the frontend, but the programme strongly prefers serverless backends.
We'd also need to configure autoscaling for this architecture and it'd cost more than using Lambda.
There's also more development overhead needed to deploy a container compared to Lambda.

## Consequences

- Minimal extra infrastructure costs
- Only using AWS tools we're already familiar with
