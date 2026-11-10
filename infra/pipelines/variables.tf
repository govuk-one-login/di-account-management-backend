# Variables for the AMB deployment pipeline (Option A: pipeline-only).
#
# Values that are identical across every environment carry a `default` here.
# Values that differ per environment are left without a default and supplied from
# `env/{env}.tfvars`. Every default below marked PLACEHOLDER must be reconciled
# against the live CloudFormation stack during Task 0 before import; the first
# `terraform plan` after import is the gate (R4.2).

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
  description = "The name of the live pipeline CloudFormation stack to adopt (Q3 — capture from the console; used as the import target)."
}

variable "pipeline_template_url" {
  type        = string
  description = "The devplatform sam-deploy-pipeline template URL. Must match the live stack's template version exactly."
  default     = "https://template-storage-templatebucket-1upzyw6v9cs42.s3.amazonaws.com/sam-deploy-pipeline/template-v2.yaml"
}

variable "sam_stack_name" {
  type        = string
  description = "The name of the SAM application stack deployed by the pipeline."
  default     = "account-mgmt-backend"
}

variable "capabilities" {
  type        = list(string)
  description = "CloudFormation capabilities. Must match the live stack exactly."
  default     = ["CAPABILITY_NAMED_IAM", "CAPABILITY_AUTO_EXPAND"]
}

# --- VPC / base-stack references (captured as literals under Option A) ----------

variable "vpc_stack_name" {
  type        = string
  description = "The name of the VPC stack the pipeline references. Captured literal; not managed by this root."
  default     = "vpc-enhanced"
}

variable "build_notification_stack_name" {
  type        = string
  description = "The name of the build-notifications stack the pipeline references. Captured literal; not managed by this root."
  default     = "build-notifications"
}

# --- Code signing ---------------------------------------------------------------

variable "signing_profile_arn" {
  type        = string
  description = "ARN of the signing profile used to sign Lambda code (per-env; from Task 0 capture)."
}

variable "signing_profile_version_arn" {
  type        = string
  description = "ARN of the signing profile version used to sign Lambda code (per-env; from Task 0 capture)."
}

variable "additional_code_signing_version_arns" {
  type        = string
  description = "ARN of an additional signing profile version (e.g. Dynatrace). Confirm the live value in Task 0."
  default     = "none"
}

variable "custom_kms_key_arn" {
  type        = string
  description = "ARN of a custom KMS key used to access secrets. Confirm the live value in Task 0."
  default     = "none"
}

# --- Promotion / artifact source ------------------------------------------------

variable "artifact_source_bucket_arn" {
  type        = string
  description = "ARN of the promotion bucket from the previous environment's pipeline."
  default     = "none"
}

variable "artifact_source_bucket_event_trigger_role_arn" {
  type        = string
  description = "ARN of the role assumed for promotion events from the previous environment's pipeline."
  default     = "none"
}

variable "repository_name" {
  type        = string
  description = "The GitHub repository name."
  default     = "di-account-management-backend"
}

variable "allowed_promotion_accounts" {
  type        = list(string)
  description = "AWS account IDs this pipeline promotes to (max 2). Per-env; from Task 0 capture."
  default     = []
}

variable "include_promotion" {
  type        = string
  description = "Whether the pipeline includes a promotion step (Yes/No). Per-env; from Task 0 capture."
  default     = "No"
}

# --- Test container -------------------------------------------------------------

variable "test_image_repository_names" {
  type        = string
  description = "ECR repo names for the test runner image. Captured literal (Option A). Empty string where not set live."
  default     = ""
}

variable "test_image_repository_uri" {
  type        = string
  description = "ECR URI for the test runner image. Captured literal (Option A). 'none' where not set live."
  default     = "none"
}

variable "test_report_format" {
  type        = string
  description = "Test report format. Confirm live value in Task 0."
  default     = "CUCUMBERJSON"
}

variable "run_test_container_in_vpc" {
  type        = string
  description = "Whether the test container runs in the VPC (True/False). Confirm live value in Task 0."
  default     = "True"
}

variable "test_compute_type" {
  type        = string
  description = "CodeBuild compute type for the test container. Confirm live value in Task 0."
  default     = "BUILD_GENERAL1_2XLARGE"
}

# --- Notifications / permissions ------------------------------------------------

variable "slack_notification_type" {
  type        = string
  description = "Slack notification type (None/Failures/All). Per-env; from Task 0 capture."
  default     = "Failures"
}

variable "programmatic_permissions_boundary" {
  type        = string
  description = "Whether a programmatic permissions boundary is applied (True/False). Confirm live value in Task 0."
  default     = "True"
}

variable "lambda_canary_deployment" {
  type        = string
  description = "Lambda canary deployment strategy. Per-env; from Task 0 capture."
  default     = "AllAtOnce"
}

variable "abort_on_checkov_failure" {
  type        = string
  description = "Deprecated devplatform parameter. Live dev value is 'CONTINUE' (template default is 'none'); captured verbatim to keep the import plan a no-op."
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
  description = "Product tag value. Only used if default_tags is enabled (Q8)."
  default     = "GOV.UK One Login"
}

variable "system" {
  type        = string
  description = "System tag value. Only used if default_tags is enabled (Q8)."
  default     = "Account Management Backend"
}

variable "owner_email" {
  type        = string
  description = "Owning team email, used for the Owner tag. Only used if default_tags is enabled (Q8)."
  default     = "govuk-accounts-tech@digital.cabinet-office.gov.uk"
}
