# Running Lambdas locally with AWS Emulator

You can run any Lambda handler from `src/` on your machine against
[AWS Emulator](https://docs.aws.amazon.com/emulator/latest/userguide/), a local
emulator of AWS service APIs (DynamoDB, SQS, KMS...). Nothing touches real AWS.

This runs **one handler at a time with an event you provide**. There is no SAM or
CloudFormation support, and nothing triggers a Lambda from a queue or a table
stream. See [Limits](#limits).

## Prerequisites

- Docker, running. (AWS Emulator only runs natively on Linux, so on macOS it
  runs in a container built from its Linux package.)
- `npm ci`
- Optional but recommended: the AWS CLI. `local:up` uses it to check it is
  talking to the emulator, and `local:invoke` uses it to send logs to CloudWatch
  Logs (without it, logs only appear in your terminal).

## Quick start

```sh
npm run local:up         # build and start the emulator, write ~/.aws/emulator/9297.env
npm run local:smoke      # optional: which AWS operations does this emulator build support?
npm run local:bootstrap  # create the tables, queues and KMS keys
npm run local:invoke -- write-activity-log   # run a Lambda with its sample event
npm run local:verify     # run the verified Lambdas and check what they wrote
npm run local:down       # stop it (all state is lost)
```

The emulator keeps **all state in memory**. After `local:down` or a restart you
need to run `local:bootstrap` again.

## Invoking a Lambda

```sh
npm run local:list                                   # functions, status and trigger
npm run local:invoke -- <function>                   # uses dev/local/events/<function>.json
npm run local:invoke -- <function> path/to/event.json
cat event.json | npm run local:invoke -- <function> -
```

The handler is bundled with esbuild from `src/` the same way `template.yaml`
does it, so there is no `sam build` step. The runner sets the function's
environment variables before loading it (some modules read them at import
time), then calls it and prints the result. It exits non-zero when the handler
throws or returns `batchItemFailures`.

Event files can be shortened for SQS: a record's `body` may be a JSON object
(it is stringified for you) and `receiptHandle`, `attributes` etc. are filled in.
DynamoDB stream and other events are passed through as written. See
`dev/local/events/` for examples.

After a run, look at what was written:

```sh
bash dev/local/with-emulator.sh aws dynamodb scan --table-name activity_log
```

`with-emulator.sh` runs any command with the emulator environment, without
changing your shell.

## Logs

A handler's logs are printed in your terminal when you run it. They are also
sent to the emulator's CloudWatch Logs, like the Lambda service does, with the
same `START` / `END` / `REPORT` lines:

```sh
npm run local:logs                          # list log groups
npm run local:logs -- write-activity-log    # show that function's logs
npm run local:logs -- write-activity-log --follow --since 1h
```

Anything after the function name is passed to `aws logs tail`. Log groups are
named `/aws/lambda/local-home-backend-<function>` and each run adds a new log
stream. They disappear when the emulator stops.

Sending logs is best-effort. If the AWS CLI is missing or the emulator build
does not support CloudWatch Logs, `local:invoke` prints a warning and carries
on. Run `npm run local:smoke` to see which CloudWatch Logs operations work.
Pass `--no-logs` (or set `LOCAL_LOGS=off`) to skip sending them.

The emulator's own logs (requests it received, errors) are separate:
`docker logs -f aws-emulator`.

## Sending TxMA events

Nothing consumes the queues locally, so to test the pipeline that starts with
TxMA events, use the interactive script:

```sh
npm run local:send-event
```

It asks which queue (`TxMAInputDummyQueue` or `TxMAIADInputDummyQueue`), then
offers to:

- **Add an event**: pick one of the event types `save-raw-events` accepts
  (or type another name to test that it is ignored), then answer prompts for
  user id, session id, client id, email, time and optional extra JSON. Blank
  prompts are left out of the event. It shows the event before sending.
- **Run `save-raw-events` on the queued events**: receives the messages,
  invokes the Lambda with them (as the SQS event source mapping would in AWS)
  and removes the ones that succeeded. Failures stay on the queue.

The result is written to the `raw_events` table. Lambdas that normally react to
that table's stream (for example `update-inactive-account-tracker`) are not run
for you: build a stream event and use `local:invoke`.

## What is created

`local:bootstrap` reads `template.yaml`, so it follows the template:

- every `AWS::DynamoDB::Table` with a resolvable name (keys, global secondary
  indexes, TTL attribute). Streams, encryption and backups are not created.
- every `AWS::SQS::Queue`, named after its logical id (for example
  `NotificationQueue`). Redrive policies and encryption are not created.
- three KMS keys (generator, wrapping, backup wrapping) for envelope encryption.

Queue URLs and key ARNs are written to `~/.aws/emulator/9297.resources.json`
and used to fill in the `*_QUEUE_URL` and `*_KEY_ARN` environment variables.

## Functions

`dev/local/functions.ts` lists every Lambda in `template.yaml` with its handler
and environment. A test (`dev/local/tests/functions.test.ts`) fails if it drifts
from the template: add a function or an env var to `template.yaml` and the test
tells you what to add.

| Status       | Meaning                                                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `verified`   | Covered by `npm run local:verify`: `save-raw-events`, `write-user-services`, `write-activity-log`, `update-inactive-account-tracker`. |
| `unverified` | The handler loads and runs, but nothing checks it, or it needs a service that has no local equivalent.                                |

`npm run local:list` shows the reason for each unverified function. The main
groups:

- **GOV.UK Notify, Zendesk, the publishing API, Account Interventions Service**
  (`send-conf-email`, `notification-service`, `create-support-ticket`,
  `delete-email-subscriptions`, `delete-inactive-account-tracker`,
  `process-inactive-account`): external HTTP APIs, and secrets that only exist in
  AWS. They are set to placeholders, so calls to them fail.
- **SNS Publish, Step Functions** (`publish-account-deletion`, `trigger-rsa-step`):
  the emulator's coverage of these was not confirmed by the compatibility check.
- **Everything else**: should work if the DynamoDB/SQS operations it uses do.
  Run `npm run local:smoke` to see which operations your emulator build
  supports.

## Checking what the emulator supports

`npm run local:smoke` creates throw-away resources (prefix `smoke-`) and tries
the operations this repo uses: table creation with a GSI and TTL, GSI queries,
conditional `UpdateItem`, `TransactWriteItems`, SQS send/receive, SNS publish,
KMS data keys, and Secrets Manager. It prints PASS/FAIL per operation and exits
non-zero if any fail. A `NotImplemented` error from the emulator means that
operation is not supported by the build you are running: it is not a
configuration problem.

The emulator is rebuilt from the latest release every time you run
`local:up`. Coverage grows between releases, so re-run the smoke test after
updating.

## Limits

- **No event sources.** SAM event source mappings, SNS subscriptions, schedules
  and Step Functions are not run. You supply the event and run the handler
  yourself. (A local queue-to-handler "pump" and running
  `npm run test:integration` locally are not done yet.)
- **State is in memory only**, and there is one account (`000000000000`).
- **One Region.** Everything runs as `eu-west-2`. The emulator does not keep
  Regions separate.
- **Not a security test.** The emulator never denies a request signed with its
  own keys, so IAM policies, KMS key policies and queue policies are not tested.
- **Not for production data.** Use made-up data only.

## Security

- The emulator is published on `127.0.0.1` only, never on all interfaces.
- Telemetry is **off** by default (`EMULATOR_TELEMETRY=off`). To turn it on:
  `EMULATOR_TELEMETRY=on npm run local:up`.
- The scripts refuse to run unless `AWS_ENDPOINT_URL` points at localhost and
  real AWS credentials are not set, so they cannot talk to real AWS by
  accident. TLS verification is never disabled: the emulator's CA
  (`~/.aws/emulator/9297/ca.pem`) is trusted via `AWS_CA_BUNDLE` and
  `NODE_EXTRA_CA_CERTS`.
- Per-run files (credentials, CA, config) live under `~/.aws/emulator/`, outside
  the repository. Never commit them.

## Troubleshooting

| Symptom                                                                                | Cause and fix                                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Docker is not running`                                                                | Start Docker.                                                                                                                                                                                                                          |
| `curl: (60) SSL certificate ... unable to get local issuer certificate` while building | Your network re-signs HTTPS traffic (for example Zscaler). Add its CA certificates (root and intermediate) to `dev/local/certs/`, see `dev/local/certs/README.md`, then run `npm run local:up` again. Do not disable TLS verification. |
| `Port 9297 is already in use`                                                          | Something else is listening there. Stop it, or run `npm run local:down` if it is a previous emulator.                                                                                                                                  |
| `AWS_ENDPOINT_URL is not set`                                                          | You ran the script directly. Use the npm scripts, or `bash dev/local/with-emulator.sh <command>`.                                                                                                                                      |
| `...resources.json not found`                                                          | Run `npm run local:bootstrap` (the emulator forgot its state).                                                                                                                                                                         |
| `unable to verify the first certificate` / `self-signed certificate`                   | The CA is new on every start. Run through the npm scripts so `NODE_EXTRA_CA_CERTS` is set before Node starts.                                                                                                                          |
| `could not send logs to CloudWatch Logs`                                               | The AWS CLI is missing, or this emulator build does not support that CloudWatch Logs operation (the message says which). The handler still ran.                                                                                        |
| `NotImplemented` (HTTP 501)                                                            | That operation is not supported by this emulator build. Run `npm run local:smoke`.                                                                                                                                                     |
| `Environment variable "X" is not set`                                                  | A new env var in `template.yaml`. Add it to the function in `dev/local/functions.ts`.                                                                                                                                                  |
| `AccessDenied` / `SignatureDoesNotMatch`                                               | The request was not signed with the emulator's credentials. Check no real AWS variables are exported.                                                                                                                                  |
