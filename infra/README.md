# AMB deployment pipeline — Terraform

This Terraform manages the [devplatform secure-pipelines](https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3059908609/How+to+deploy+a+SAM+application+with+secure+pipelines)
`sam-deploy-pipeline` stack (template `v2.106.0`) for the account management
backend.

The parameter set mirrors the live stacks captured in Task 0
(`.kiro/specs/OLH-5367_amb-pipeline-iac/task0-pipeline-capture.md`). Values that
are identical across environments are defaulted in `variables.tf`; the few that
differ per environment are supplied from `env/{env}.tfvars`.

## Layout

| Path                      | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `providers.tf`            | Terraform + AWS provider config (incl. `default_tags`) |
| `pipelines.tf`            | The `aws_cloudformation_stack` pipeline resource      |
| `variables.tf`            | Input variables and their shared defaults             |
| `env/{env}.tfvars`        | Per-environment variable values                       |
| `env/deploy/{env}.tfbackend` | Per-environment S3 backend configuration           |

Supported environments: `dev`, `build`, `staging`, `integration`, `production`,
`demo`.

## Prerequisites

- [`tfenv`](https://github.com/tfutils/tfenv) to manage the Terraform version
  (pinned in `.terraform-version`).
- AWS credentials for the target account (via `gds aws <profile>` or `aws sso login`).

## Deploying

The Terraform uses a separate backend configuration and variables file per
environment. To deploy into e.g. `build`:

```sh
cd infra

# Install and select the pinned Terraform version.
tfenv install && tfenv use

# Authenticate against the target account.
gds aws di-account-build-admin
# or: aws sso login --profile di-account-build-admin

# Initialise with the environment's backend, then plan and apply.
terraform init -backend-config=env/deploy/build.tfbackend
terraform plan  -var-file=env/build.tfvars
terraform apply -var-file=env/build.tfvars
```

Swap `build` for `dev`, `staging`, `integration`, `production`, or `demo` to
target a different environment. Always review the `plan` output before applying —
for an already-deployed pipeline the plan should be a no-op (or contain only the
expected drift).

> **Note:** `terraform init` reconfigures the backend per environment. When
> switching environments in the same working directory, re-run
> `terraform init -reconfigure -backend-config=env/deploy/{env}.tfbackend`.
