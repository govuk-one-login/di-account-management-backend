# AMB deployment pipeline — devplatform secure-pipelines (sam-deploy-pipeline).
# See https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3059908609/How+to+deploy+a+SAM+application+with+secure+pipelines
#
# Option A (pipeline-only): the VPC / build-notifications / test-image stacks are
# NOT managed by this root. Their values are captured as literals/variables from
# the live stack. There is intentionally no `depends_on` on sibling resources.
#
# Fidelity over cleanliness: every parameter below must reproduce the live stack's
# value exactly so the first `terraform plan` after import is a no-op (R4.2).
# Values come from variables.tf defaults (identical across envs) or env/{env}.tfvars
# (per-env), populated from the Task 0 capture.

resource "aws_cloudformation_stack" "amb_pipeline_stack" {
  name         = var.pipeline_stack_name
  template_url = var.pipeline_template_url

  parameters = merge(
    {
      SAMStackName                            = var.sam_stack_name
      Environment                             = var.environment
      VpcStackName                            = var.vpc_stack_name
      SigningProfileArn                       = var.signing_profile_arn
      SigningProfileVersionArn                = var.signing_profile_version_arn
      AdditionalCodeSigningVersionArns        = var.additional_code_signing_version_arns
      CustomKmsKeyArns                        = var.custom_kms_key_arn
      ArtifactSourceBucketArn                 = var.artifact_source_bucket_arn
      ArtifactSourceBucketEventTriggerRoleArn = var.artifact_source_bucket_event_trigger_role_arn
      GitHubRepositoryName                    = var.repository_name
      TestImageRepositoryNames                = var.test_image_repository_names
      TestImageRepositoryUri                  = var.test_image_repository_uri
      TestReportFormat                        = var.test_report_format
      RunTestContainerInVPC                   = var.run_test_container_in_vpc
      TestComputeType                         = var.test_compute_type
      IncludePromotion                        = var.include_promotion
      AllowedAccounts                         = join(",", var.allowed_promotion_accounts)
      BuildNotificationStackName              = var.build_notification_stack_name
      SlackNotificationType                   = var.slack_notification_type
      ProgrammaticPermissionsBoundary         = var.programmatic_permissions_boundary
      LambdaCanaryDeployment                  = var.lambda_canary_deployment
      AbortOnCheckovFailure                   = var.abort_on_checkov_failure
    },
    var.allowed_services,
  )

  capabilities = var.capabilities
}
