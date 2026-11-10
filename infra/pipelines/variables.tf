# Variables for the AMB deployment pipeline.
#
# Values that are identical across every environment carry a `default` here.
# Values that differ per environment are left without a default and supplied from
# `env/{env}.tfvars`. 

variable "environment" {
  type        = string
  description = "The environment name."
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
  description = "The devplatform sam-deploy-pipeline template URL."
  default     = "https://template-storage-templatebucket-1upzyw6v9cs42.s3.amazonaws.com/sam-deploy-pipeline/template-v2.yaml"
}

variable "sam_stack_name" {
  type        = string
  description = "The name of the SAM application stack deployed by the pipeline."
  default     = "account-mgmt-backend"
}

variable "capabilities" {
  type        = list(string)
  description = "CloudFormation capabilities."
  default     = ["CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"]
}

# --- VPC / base-stack references ----------

variable "vpc_stack_name" {
  type        = string
  description = "The name of the VPC stack the pipeline references."
  default     = "vpc-enhanced"
}

variable "build_notification_stack_name" {
  type        = string
  description = "The name of the build-notifications stack the pipeline references."
  default     = "build-notifications"
}

# --- Code signing ---------------------------------------------------------------

variable "signing_profile_arn" {
  type        = string
  description = "ARN of the signing profile used to sign Lambda code (per-env)."
}

variable "signing_profile_version_arn" {
  type        = string
  description = "ARN of the signing profile version used to sign Lambda code (per-env)."
}

variable "additional_code_signing_version_arns" {
  type        = string
  description = "ARN of an additional signing profile version (e.g. Dynatrace)."
  default     = "none"
}

variable "custom_kms_key_arn" {
  type        = string
  description = "ARN of a custom KMS key used to access secrets."
  default     = "none"
}

# --- Promotion / artifact source ------------------------------------------------

variable "artifact_source_bucket_arn" {
  type        = string
  description = "ARN of the promotion bucket"
  default     = "none"
}

variable "artifact_source_bucket_event_trigger_role_arn" {
  type        = string
  description = "ARN of the role assumed for promotion events"
  default     = "none"
}

variable "repository_name" {
  type        = string
  description = "The GitHub repository name."
  default     = "di-account-management-backend"
}

variable "allowed_promotion_accounts" {
  type        = list(string)
  description = "AWS account IDs this pipeline promotes to (per-env)"
  default     = []
}

variable "include_promotion" {
  type        = string
  description = "Whether the pipeline includes a promotion step (Yes/No) (per-env)."
  default     = "No"
}

# --- Test container -------------------------------------------------------------

variable "test_image_repository_names" {
  type        = string
  description = "ECR repo names for the test runner image"
  default     = ""
}

variable "test_image_repository_uri" {
  type        = string
  description = "ECR URI for the test runner image."
  default     = "none"
}

variable "test_report_format" {
  type        = string
  description = "Test report format."
  default     = "CUCUMBERJSON"
}

variable "run_test_container_in_vpc" {
  type        = string
  description = "Whether the test container runs in the VPC (True/False)."
  default     = "True"
}

variable "test_compute_type" {
  type        = string
  description = "CodeBuild compute type for the test container."
  default     = "BUILD_GENERAL1_2XLARGE"
}

# --- Notifications / permissions ------------------------------------------------

variable "slack_notification_type" {
  type        = string
  description = "Slack notification type (None/Failures/All). Per-env;"
  default     = "Failures"
}

variable "programmatic_permissions_boundary" {
  type        = string
  description = "Whether a programmatic permissions boundary is applied (True/False)."
  default     = "True"
}

variable "lambda_canary_deployment" {
  type        = string
  description = "Lambda canary deployment strategy. Per-env"
  default     = "AllAtOnce"
}

variable "abort_on_checkov_failure" {
  type        = string
  description = "Deprecated devplatform parameter. Live dev value is 'CONTINUE' (template default is 'none');"
  default     = "none"
}

variable "allowed_services" {
  type        = map(string)
  description = <<-EOT
    The AllowedServiceOne..N pipeline parameters, keyed by their parameter name.
    Captured verbatim from the live stack in Task 0. Example:
    { AllowedServiceOne = "AppConfig", AllowedServiceTwo = "EC2", ... }
  EOT
  default     = {}
}

# --- Tagging (only used if default_tags is enabled after Q8 confirmation) -------

variable "product" {
  type        = string
  description = "Product tag value."
  default     = "GOV.UK One Login"
}

variable "system" {
  type        = string
  description = "System tag value."
  default     = "Account Management Backend"
}

variable "owner_email" {
  type        = string
  description = "Owning team email, used for the Owner tag."
  default     = "govuk-accounts-tech@digital.cabinet-office.gov.uk"
}
