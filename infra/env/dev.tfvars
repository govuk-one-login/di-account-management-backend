# Dev (account 985326104449) — pipeline stack account-mgmt-backend-pipeline.
#
# Captured 2026-11-12 via di-account-dev-fulladmin (AdministratorAccess) with
# `aws cloudformation describe-stacks`. The dev stack was captured on devplatform
# sam-deploy-pipeline template v2.105.1; this config bumps it to v2.106.0 to
# align with the staging / integration / production group (the parameter KEY set
# is identical between the two, so the shared variables schema applies). Values
# below are verbatim from the live dev stack; dev differs from the shared group
# in several fields (repo name, signer account, Slack type, InvokableLambdaAccounts).

environment         = "dev"
pipeline_stack_name = "account-mgmt-backend-pipeline"

# Per-env parameters.
allowed_accounts           = null
include_promotion          = "No"
lambda_canary_deployment   = "AllAtOnce"
artifact_source_bucket_arn = "none"

# Dev-specific overrides of shared defaults (verbatim from the live dev stack).
github_repository_name    = "di-account-management-backend"
invokable_lambda_accounts = null
slack_notification_type   = "All"

# Dev-account code signing (differs from the shared build-account signer).
signing_profile_arn         = "arn:aws:signer:eu-west-2:985326104449:/signing-profiles/SigningProfile_vpuDZuASeOD0"
signing_profile_version_arn = "arn:aws:signer:eu-west-2:985326104449:/signing-profiles/SigningProfile_vpuDZuASeOD0/KCAqQdGK8H"

# Dev template is now aligned to the group's v2.106.0 (bumped from v2.105.1).
pipeline_template_url = "https://template-storage-templatebucket-1upzyw6v9cs42.s3.amazonaws.com/sam-deploy-pipeline/template-v2.106.0.yaml"
