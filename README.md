# di-account-management-backend

The backend and data store that serves the account management application.

This is a serverless application for AWS. It's built and deployed using the [SAM CLI](https://aws.amazon.com/serverless/sam/).

## Prerequisites

We recommend using [`nvm`](https://github.com/nvm-sh/nvm) to install and manage Node.js versions. Run

```
nvm install
```

from the root of the repository or in any `lambda/` folder to install the correct version on Node.

We transpile and package the Lambda functions using `sam build`. This needs `esbuild` installed globally:

```
npm install -g esbuild
```

## Testing

Each Lambda function is a separate NPM application and has its own unit tests.

To run the tests for the `query-user-services` Lambda:

```bash
cd lambda/query-user-services
npm ci
npm run lint
npm run test
```

## Deploying the application

Deploy the application to the `dev` AWS account by running

```bash
cd infrastructure
sam build
gds aws di-account-dev -- sam deploy
```

Once the application is deployed to `dev` we can test it by adding a fake event to the input queue:

1. Open the AWS console for the `dev` account (`gds aws di-account-dev`) and go to [the SQS page](https://eu-west-2.console.aws.amazon.com/sqs/v2/home?region=eu-west-2#/queues).
2. Find the input queue for your stack and copy the queue URL.
3. Send an event to the queue using the AWS CLI:

```bash
gds aws di-account-dev -- aws sqs send-message \
  --queue-url QUEUE_URL \
  --message-body '{"event_name":"event-name","timestamp":1666169856,"client_id":"client-id","user":{"user_id":"user_id"}}'
```
