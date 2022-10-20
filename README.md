# di-account-management-backend

The backend and data store that serves the account management application.

This is a serverless application for AWS. It's built and deployed using the [SAM CLI](https://aws.amazon.com/serverless/sam/).

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
