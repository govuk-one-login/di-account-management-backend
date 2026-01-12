# di-account-management-backend

The backend and data store that serves the account management application.

This is a serverless application for AWS. It's built and deployed using the [SAM CLI](https://aws.amazon.com/serverless/sam/).

## Prerequisites

We recommend using [`nvm`](https://github.com/nvm-sh/nvm) to install and manage Node.js versions. Run:
- Install [Homebrew](https://brew.sh/)
- Install Brewfile dependencies with `npm run install-brewfile`
- Install Git Hooks with `npm run install-git-hooks`

```
nvm install
```

from the root of the repository or in any `lambda/` folder to install the correct version on Node.

We transpile and package the Lambda functions using `sam build`. This needs `esbuild` installed globally:

```
npm install -g esbuild
```

### Gitlint

This repository uses [Gitlint](https://jorisroovers.com/gitlint/latest/) to lint git commit messages.

Install Gitlint by running:

```bash
pip install gitlint # or `brew install gitlint` if using the Homebrew package manager
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

### Pre-merge tests

We run pre-merge regression tests before feature changes are merged to the main branch.

This test will instrument environment setup and deployment to a test account `(di-account-test - 654654326096)` and
then run a few tests to confirm critical functionalities are not broken as part of the code to be merged.

This run takes approximately 20 minutes to complete as it has to create the artifacts,
deploy to a new environment and run tests, as a result, we have introduced the ability to
skip pre-merge regression testing where there is a requirement to push the change live ASAP.
To do this, the keyword “skipPreMerge” has to be present in the last commit messages for the feature branch
that is being merged to main.

The configuration to ensure this test is configured in workflows and the branch config itself, where

- We require a status check to pass before merging, in this case the status check is the Pre-Merge Test.
- Merges are completed via merge queues and where the status check above fails, the merge attempt is removed from the merge queue.

### Post-deploy tests

We run integration tests against the deployed application in our build environment as part of the pipeline.
We bundle them in `post-deploy-tests.Dockerfile`; this contains a `/run-tests.sh` script which wraps the tests.

To run the container locally against the build environment run:

```bash
aws sso login --profile di-account-build-admin

eval "$(aws configure export-credentials --profile di-account-build-admin --format env)"

docker build . -t test -f post-deploy-tests.Dockerfile

docker run -t \
  -e AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
  -e AWS_SESSION_TOKEN=$AWS_SESSION_TOKEN \
  -e AWS_SECURITY_TOKEN=$AWS_SECURITY_TOKEN \
  -e AWS_DEFAULT_REGION="eu-west-2" \
  test
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

## Sending support ticket for reported suspicious activity

### Summary

- When a suspicious activity is added to the SNS topic, this create-support-ticket lambda is triggered, it creates a Zendesk Ticket using the key value pair of the event body.

### What the Lambda does

- Ensure all environment variables required to successfully connect to, create ticket and send to Zendesk are provided
- Validates the fields in the received event
- Retrieves the values for the environment variable keys in AWS Secrets
- Validates that values exist for the required keys - these include zendesk api credentials, groups, etc
- Creates a zendesk ticket and sends to Zendesk
- If any of the steps above fails, send the SNS record to DLQ for retry later
