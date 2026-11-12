# Variables for the AMB deployment pipeline (devplatform sam-deploy-pipeline v2.106.0).
#
# Values that are identical across staging / integration / production carry a
# `default` here, captured verbatim from the live stacks in Task 0
# (.kiro/specs/OLH-5367_amb-pipeline-iac/task0-pipeline-capture.md).
#
# Values that differ per environment are left WITHOUT a default and supplied from
# `env/{env}.tfvars`. There are exactly five of these:
#   environment, allowed_accounts, include_promotion,
#   lambda_canary_deployment, artifact_source_bucket_arn.

variable "environment" {
  type        = string
  description = "The environment name (maps to the Environment pipeline parameter)."
  validation {
    condition     = contains(["dev", "build", "staging", "integration", "production"], var.environment)
    error_message = "Valid values for var: environment are (dev, build, staging, integration, production)."
  }
}

# --- Stack identity -------------------------------------------------------------

variable "pipeline_stack_name" {
  type        = string
  description = "The name of the live pipeline CloudFormation stack."
}

variable "pipeline_template_url" {
  type        = string
  description = "The devplatform sam-deploy-pipeline template URL (pinned to v2.106.0)."
  default     = "https://template-storage-templatebucket-1upzyw6v9cs42.s3.amazonaws.com/sam-deploy-pipeline/template-v2.106.0.yaml"
}

variable "sam_stack_name" {
  type        = string
  description = "The name of the SAM application stack deployed by the pipeline (SAMStackName)."
  default     = "account-mgmt-backend"
}

variable "capabilities" {
  type        = list(string)
  description = "CloudFormation capabilities. Live stacks use CAPABILITY_NAMED_IAM only."
  default     = ["CAPABILITY_NAMED_IAM"]
}

# --- Per-environment parameters (no default; supplied from env/{env}.tfvars) ----

variable "allowed_accounts" {
  type        = string
  description = "Comma-separated AWS account IDs this pipeline promotes to (AllowedAccounts) (per-env)."
}

variable "include_promotion" {
  type        = string
  description = "Whether the pipeline includes a promotion step (IncludePromotion, Yes/No) (per-env)."
}

variable "lambda_canary_deployment" {
  type        = string
  description = "Lambda canary deployment strategy (LambdaCanaryDeployment) (per-env)."
}

variable "artifact_source_bucket_arn" {
  type        = string
  description = "ARN of the promotion artifact source bucket (ArtifactSourceBucketArn) (per-env)."
}

# --- VPC / base-stack references ------------------------------------------------

variable "vpc_stack_name" {
  type        = string
  description = "The name of the VPC stack the pipeline references (VpcStackName)."
  default     = "vpc-enhanced"
}

variable "build_notification_stack_name" {
  type        = string
  description = "The name of the build-notifications stack the pipeline references (BuildNotificationStackName)."
  default     = "platform-alerting"
}

# --- Source repository ----------------------------------------------------------

variable "github_organization_name" {
  type        = string
  description = "The GitHub organization name (GitHubOrganizationName)."
  default     = "govuk-one-login"
}

variable "github_repository_name" {
  type        = string
  description = "The GitHub repository name (GitHubRepositoryName)."
  default     = "none"
}

variable "one_login_repository_name" {
  type        = string
  description = "OneLoginRepositoryName pipeline parameter."
  default     = "none"
}

variable "service_name" {
  type        = string
  description = "ServiceName pipeline parameter."
  default     = "none"
}

# --- Code signing ---------------------------------------------------------------

variable "signing_profile_arn" {
  type        = string
  description = "ARN of the signing profile used to sign Lambda code (SigningProfileArn)."
  default     = "arn:aws:signer:eu-west-2:301577035144:/signing-profiles/SigningProfile_yPKkKGDvkzOL"
}

variable "signing_profile_version_arn" {
  type        = string
  description = "ARN of the signing profile version used to sign Lambda code (SigningProfileVersionArn)."
  default     = "arn:aws:signer:eu-west-2:301577035144:/signing-profiles/SigningProfile_yPKkKGDvkzOL/zB61DrvMj0"
}

variable "additional_code_signing_version_arns" {
  type        = string
  description = "ARN of an additional signing profile version, e.g. Dynatrace (AdditionalCodeSigningVersionArns)."
  default     = "arn:aws:signer:eu-west-2:216552277552:/signing-profiles/DynatraceSigner/5uwzCCGTPq"
}

variable "container_signer_kms_key_arn" {
  type        = string
  description = "ContainerSignerKmsKeyArn pipeline parameter."
  default     = "none"
}

variable "custom_kms_key_arns" {
  type        = string
  description = "ARN of a custom KMS key used to access secrets (CustomKmsKeyArns)."
  default     = "arn:aws:kms:eu-west-2:216552277552:key/4bc58ab5-c9bb-4702-a2c3-5d339604a8fe"
}

# --- Promotion / artifact source ------------------------------------------------

variable "artifact_source_bucket_event_trigger_role_arn" {
  type        = string
  description = "ARN of the role assumed for promotion events (ArtifactSourceBucketEventTriggerRoleArn)."
  default     = "none"
}

variable "artifact_write_time_logging_lambda_arn" {
  type        = string
  description = "ArtifactWriteTimeLoggingLambdaArn pipeline parameter."
  default     = "None"
}

# --- Cross-account access -------------------------------------------------------

variable "access_cross_account_sns" {
  type        = string
  description = "AccessCrossAccountSNS pipeline parameter."
  default     = ""
}

variable "access_cross_account_sqs" {
  type        = string
  description = "AccessCrossAccountSQS pipeline parameter."
  default     = ""
}

variable "access_dynamo_db_accounts" {
  type        = string
  description = "AccessDynamoDBAccounts pipeline parameter."
  default     = ""
}

variable "allow_cross_account_assume_role_target_accounts" {
  type        = string
  description = "AllowCrossAccountAssumeRoleTargetAccounts pipeline parameter."
  default     = ""
}

variable "allow_cross_account_s3_write_access" {
  type        = string
  description = "AllowCrossAccountS3WriteAccess pipeline parameter (True/False)."
  default     = "False"
}

variable "invokable_lambda_accounts" {
  type        = string
  description = "InvokableLambdaAccounts pipeline parameter."
  default     = "none"
}

variable "lambda_layers_accounts" {
  type        = string
  description = "LambdaLayersAccounts pipeline parameter."
  default     = ""
}

variable "aws_organization_id" {
  type        = string
  description = "AWSOrganizationId pipeline parameter (comma-separated org IDs)."
  default     = "o-pjzf8d99ys,o-dpp53lco28"
}

variable "sar_account_id" {
  type        = string
  description = "SARAccountId pipeline parameter."
  default     = ""
}

# --- Test container -------------------------------------------------------------

variable "test_image_repository_names" {
  type        = string
  description = "ECR repo names for the test runner image (TestImageRepositoryNames)."
  default     = ""
}

variable "test_image_repository_uri" {
  type        = string
  description = "ECR URI for the test runner image (TestImageRepositoryUri)."
  default     = "none"
}

variable "test_report_format" {
  type        = string
  description = "Test report format (TestReportFormat)."
  default     = "JUNITXML"
}

variable "test_coverage_report_format" {
  type        = string
  description = "Test coverage report format (TestCoverageReportFormat)."
  default     = "CLOVERXML"
}

variable "run_test_container_in_vpc" {
  type        = string
  description = "Whether the test container runs in the VPC (RunTestContainerInVPC, True/False)."
  default     = "False"
}

variable "test_compute_type" {
  type        = string
  description = "CodeBuild compute type for the test container (TestComputeType)."
  default     = "BUILD_GENERAL1_SMALL"
}

variable "test_container_allow_cross_account_assume_role" {
  type        = string
  description = "TestContainerAllowCrossAccountAssumeRole pipeline parameter (Yes/No)."
  default     = "No"
}

variable "test_stack_name" {
  type        = string
  description = "TestStackName pipeline parameter."
  default     = "None"
}

variable "test_stage_name" {
  type        = string
  description = "TestStageName pipeline parameter."
  default     = "Test"
}

variable "require_test_container_signature_validation" {
  type        = string
  description = "RequireTestContainerSignatureValidation pipeline parameter (Yes/No)."
  default     = "No"
}

# --- Parallel test container ----------------------------------------------------

variable "parallel_test_compute_type" {
  type        = string
  description = "ParallelTestComputeType pipeline parameter."
  default     = "BUILD_GENERAL1_SMALL"
}

variable "parallel_test_coverage_report_format" {
  type        = string
  description = "ParallelTestCoverageReportFormat pipeline parameter."
  default     = "CLOVERXML"
}

variable "parallel_test_image_repository_uri" {
  type        = string
  description = "ParallelTestImageRepositoryUri pipeline parameter."
  default     = "none"
}

variable "parallel_test_report_format" {
  type        = string
  description = "ParallelTestReportFormat pipeline parameter."
  default     = "JUNITXML"
}

variable "parallel_test_stack_name" {
  type        = string
  description = "ParallelTestStackName pipeline parameter."
  default     = "None"
}

variable "parallel_test_stage_name" {
  type        = string
  description = "ParallelTestStageName pipeline parameter."
  default     = "ParallelTest"
}

variable "require_parallel_test_container_signature_validation" {
  type        = string
  description = "RequireParallelTestContainerSignatureValidation pipeline parameter (Yes/No)."
  default     = "No"
}

variable "run_parallel_test_container_in_vpc" {
  type        = string
  description = "RunParallelTestContainerInVPC pipeline parameter (True/False)."
  default     = "False"
}

# --- Other test / image repositories --------------------------------------------

variable "one_login_test_image_repository_names" {
  type        = string
  description = "OneLoginTestImageRepositoryNames pipeline parameter."
  default     = ""
}

variable "traffic_test_image_repository_uri" {
  type        = string
  description = "TrafficTestImageRepositoryUri pipeline parameter."
  default     = "none"
}

variable "store_test_report_in_s3_bucket" {
  type        = string
  description = "StoreTestReportInS3Bucket pipeline parameter (Yes/No)."
  default     = "No"
}

# --- Canary / deployment strategies (non per-env) -------------------------------

variable "ecs_canary_deployment" {
  type        = string
  description = "ECSCanaryDeployment pipeline parameter."
  default     = "None"
}

variable "step_functions_canary_deployment" {
  type        = string
  description = "StepFunctionsCanaryDeployment pipeline parameter."
  default     = "None"
}

# --- Notifications / permissions ------------------------------------------------

variable "slack_notification_type" {
  type        = string
  description = "Slack notification type (SlackNotificationType, None/Failures/All)."
  default     = "Failures"
}

variable "programmatic_permissions_boundary" {
  type        = string
  description = "Whether a programmatic permissions boundary is applied (ProgrammaticPermissionsBoundary, True/False)."
  default     = "False"
}

variable "require_manual_approval" {
  type        = string
  description = "RequireManualApproval pipeline parameter (Yes/No)."
  default     = "No"
}

variable "circuit_breaker" {
  type        = string
  description = "CircuitBreaker pipeline parameter (Enabled/Disabled)."
  default     = "Disabled"
}

variable "abort_on_checkov_failure" {
  type        = string
  description = "AbortOnCheckovFailure pipeline parameter. Live value is CONTINUE."
  default     = "CONTINUE"
}

# --- Logging / access logs ------------------------------------------------------

variable "log_retention_days" {
  type        = string
  description = "LogRetentionDays pipeline parameter."
  default     = "7"
}

variable "access_logs_custom_bucket_name_enabled" {
  type        = string
  description = "AccessLogsCustomBucketNameEnabled pipeline parameter (Yes/No)."
  default     = "Yes"
}

# --- Misc pipeline naming / behaviour -------------------------------------------

variable "dynamic_resources_prefix" {
  type        = string
  description = "DynamicResourcesPrefix pipeline parameter."
  default     = "none"
}

variable "pipeline_environment_name_enabled" {
  type        = string
  description = "PipelineEnvironmentNameEnabled pipeline parameter (Yes/No)."
  default     = "No"
}

variable "sub_environment" {
  type        = string
  description = "SubEnvironment pipeline parameter."
  default     = "none"
}

variable "truncated_pipeline_stack_name" {
  type        = string
  description = "TruncatedPipelineStackName pipeline parameter."
  default     = "none"
}

# --- AllowedServiceOne..Seven ---------------------------------------------------

variable "allowed_services" {
  type        = map(string)
  description = <<-EOT
    The AllowedServiceOne..Seven pipeline parameters, keyed by their parameter
    name. Captured verbatim from the live v2.106.0 stacks in Task 0 (all "none").
  EOT
  default = {
    AllowedServiceOne   = "none"
    AllowedServiceTwo   = "none"
    AllowedServiceThree = "none"
    AllowedServiceFour  = "none"
    AllowedServiceFive  = "none"
    AllowedServiceSix   = "none"
    AllowedServiceSeven = "none"
  }
}

# --- Tagging --------------------------------------------------------------------

variable "product" {
  type        = string
  description = "Product tag value."
  default     = "GOV.UK One Login"
}

variable "system" {
  type        = string
  description = "System tag value."
  default     = "Account Management"
}

variable "owner_email" {
  type        = string
  description = "Owning team email, used for the Owner tag."
  default     = "govuk-accounts-tech@digital.cabinet-office.gov.uk"
}

variable "additional_tags" {
  type        = map(string)
  description = <<-EOT
    Extra resource tags that are present on some environments only, captured
    verbatim from the live stacks in Task 0. The common tags (Environment,
    Owner, Product, System) are set from their own variables in pipelines.tf;
    this map carries any per-env extras (e.g. staging's `repository` tag).
  EOT
  default     = {}
}
