# Staging (account 539729775994) — pipeline stack account-mgmt-backend-pipeline.
# Values captured verbatim from the live stack.
# Only the five per-env parameters differ from the defaults in variables.tf.

environment         = "staging"
pipeline_stack_name = "account-mgmt-backend-pipeline"

allowed_accounts           = "666500506359,026991849909"
include_promotion          = "Yes"
lambda_canary_deployment   = "AllAtOnce"
artifact_source_bucket_arn = "arn:aws:s3:::account-mgmt-backend-pipe-artifactpromotionbucket-10kfoi1qnfsax"

# Staging is the only env carrying this tag on the live stack.
additional_tags = {
  repository = "alphagov/di-account-management-backend"
}
