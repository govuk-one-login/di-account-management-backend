environment = "dev"

pipeline_stack_name = "account-mgmt-backend-pipeline"

vpc_stack_name                = "vpc-enhanced"
build_notification_stack_name = "platform-alerting"

repository_name = "di-account-management-backend"

# Code signing.
signing_profile_arn                  = "arn:aws:signer:eu-west-2:985326104449:/signing-profiles/SigningProfile_vpuDZuASeOD0"
signing_profile_version_arn          = "arn:aws:signer:eu-west-2:985326104449:/signing-profiles/SigningProfile_vpuDZuASeOD0/KCAqQdGK8H"
additional_code_signing_version_arns = "arn:aws:signer:eu-west-2:216552277552:/signing-profiles/DynatraceSigner/5uwzCCGTPq"
custom_kms_key_arn                   = "arn:aws:kms:eu-west-2:216552277552:key/4bc58ab5-c9bb-4702-a2c3-5d339604a8fe"

# Promotion / notifications.
include_promotion          = "No"
allowed_promotion_accounts = []
slack_notification_type    = "All"
lambda_canary_deployment   = "AllAtOnce"

abort_on_checkov_failure = "CONTINUE"

programmatic_permissions_boundary = "False"
allowed_services                  = {}

test_report_format        = "JUNITXML"
run_test_container_in_vpc = "False"
test_compute_type         = "BUILD_GENERAL1_SMALL"
