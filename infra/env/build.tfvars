# Build (account 301577035144) — pipeline stack account-mgmt-backend-pipeline.
#
# Captured 2026-11-12 from the AWS console (ApprovedPowerUser is SCP-denied
# cloudformation:* for CLI access, so values were read from the CloudFormation
# console Parameters tab). Template version v2.106.0 — same parameter key set as
# the staging / integration / production group, so the shared schema applies.
#
# Build is the SOURCE environment: it runs the test container (real ECR image,
# cucumber/simplecov report formats, a dedicated test stack) and promotes to
# staging. These differ from the shared defaults and are overridden below.

environment         = "build"
pipeline_stack_name = "account-mgmt-backend-pipeline"

# Per-env parameters.
allowed_accounts           = "539729775994"
include_promotion          = "Yes"
lambda_canary_deployment   = "AllAtOnce"
artifact_source_bucket_arn = "none"

# Build-specific overrides of shared defaults (verbatim from the live stack).
github_repository_name = "di-account-management-backend"

# Build is where the test container actually runs.
test_report_format          = "CUCUMBERJSON"
test_coverage_report_format = "SIMPLECOV"
test_image_repository_uri   = "301577035144.dkr.ecr.eu-west-2.amazonaws.com/account-mgmt-backend-test-image-repo-testrunnerimagerepository-4dth9sr21cvl"
test_stack_name             = "build-account-mgmt-backend"
