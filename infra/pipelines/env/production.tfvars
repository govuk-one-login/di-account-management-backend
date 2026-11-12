# Production (account 026991849909) — pipeline stack account-mgmt-backend-pipeline.
# Values captured verbatim from the live v2.106.0 stack in Task 0
# (.kiro/specs/OLH-5367_amb-pipeline-iac/task0-pipeline-capture.md).
# Only the five per-env parameters differ from the defaults in variables.tf.

environment         = "production"
pipeline_stack_name = "account-mgmt-backend-pipeline"

allowed_accounts           = ""
include_promotion          = "No"
lambda_canary_deployment   = "Linear10PercentEvery1Minute"
artifact_source_bucket_arn = "arn:aws:s3:::account-mgmt-backend-pipe-artifactpromotionbucket-286ydfbfcxrc"
