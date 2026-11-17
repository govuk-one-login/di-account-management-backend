# Infrastructure — Terraform

Terraform for the account management backend's infrastructure. It currently
manages the [devplatform secure-pipelines](https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3059908609/How+to+deploy+a+SAM+application+with+secure+pipelines)
`sam-deploy-pipeline` stack (see `pipelines.tf`).

Values that are identical across environments are defaulted in `variables.tf`;
the few that differ per environment are supplied from `env/{env}.tfvars`.

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
- AWS admin access to the target account. Use TEAM to get permissions for all
  environments other than `dev`. You'll need to request the admin role, not
  power user.

You can add a section like the following to your `~/.aws/config` file to use
the admin role as a CLI profile (note the `-admin` suffix). Replace the account
ID with that of the environment you are deploying to:

```
[profile di-account-build-admin]
sso_session = one-login
sso_account_id = <ACCOUNT_ID>
sso_role_name = ApprovedAdmin
region = eu-west-2
sso_region = eu-west-2
sso_start_url = https://uk-digital-identity.awsapps.com/start
```

## Deploying

The Terraform uses a separate backend configuration and variables file per
environment. To deploy into e.g. `build`, run:

```sh
tfenv install && tfenv use
cd infra
export AWS_PROFILE=di-account-build-admin
aws sso login
terraform init -backend-config=env/deploy/build.tfbackend
terraform plan -var-file=env/build.tfvars
terraform apply -var-file=env/build.tfvars
```

Swap `build` for `dev`, `staging`, `integration`, `production`, or `demo` to
target a different environment. Always review the `plan` output before applying —
for already-deployed infrastructure the plan should be a no-op (or contain only the
expected drift).

> [!NOTE]
> You'll get a warning about an existing backend when running `terraform init`
> if you've already initialised a backend for a different environment.
>
> You should re-run your command with the `-reconfigure` flag as we don't want
> to migrate state between environments:
>
> `terraform init -backend-config=env/deploy/dev.tfbackend -reconfigure`
