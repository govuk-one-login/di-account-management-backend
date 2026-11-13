# AMB deployment pipeline — devplatform secure-pipelines (sam-deploy-pipeline v2.106.0).
# See https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3059908609/How+to+deploy+a+SAM+application+with+secure+pipelines
#
# The parameter set below mirrors the live v2.106.0 template exactly (70 params),
# captured in Task 0. Values identical across staging/integration/production are
# defaulted in variables.tf; the five per-env values come from env/{env}.tfvars.

resource "aws_cloudformation_stack" "amb_pipeline_stack" {
  name         = var.pipeline_stack_name
  template_url = var.pipeline_template_url

  # Parameters whose value is null are omitted entirely so the stack shows them
  # as "no value" (a hyphen in the console) rather than an empty string. See
  # review comment on variables.tf: unset params must be null, not "".
  parameters = {
    for key, value in merge(
      {
        # Stack identity
        SAMStackName = var.sam_stack_name
        Environment  = var.environment

        # Source repository
        GitHubOrganizationName = var.github_organization_name
        GitHubRepositoryName   = var.github_repository_name
        OneLoginRepositoryName = var.one_login_repository_name
        ServiceName            = var.service_name

        # VPC / base-stack references
        VpcStackName               = var.vpc_stack_name
        BuildNotificationStackName = var.build_notification_stack_name

        # Code signing
        SigningProfileArn                = var.signing_profile_arn
        SigningProfileVersionArn         = var.signing_profile_version_arn
        AdditionalCodeSigningVersionArns = var.additional_code_signing_version_arns
        ContainerSignerKmsKeyArn         = var.container_signer_kms_key_arn
        CustomKmsKeyArns                 = var.custom_kms_key_arns

        # Promotion / artifact source
        IncludePromotion                        = var.include_promotion
        AllowedAccounts                         = var.allowed_accounts
        ArtifactSourceBucketArn                 = var.artifact_source_bucket_arn
        ArtifactSourceBucketEventTriggerRoleArn = var.artifact_source_bucket_event_trigger_role_arn
        ArtifactWriteTimeLoggingLambdaArn       = var.artifact_write_time_logging_lambda_arn

        # Cross-account access
        AccessCrossAccountSNS                     = var.access_cross_account_sns
        AccessCrossAccountSQS                     = var.access_cross_account_sqs
        AccessDynamoDBAccounts                    = var.access_dynamo_db_accounts
        AllowCrossAccountAssumeRoleTargetAccounts = var.allow_cross_account_assume_role_target_accounts
        AllowCrossAccountS3WriteAccess            = var.allow_cross_account_s3_write_access
        InvokableLambdaAccounts                   = var.invokable_lambda_accounts
        LambdaLayersAccounts                      = var.lambda_layers_accounts
        AWSOrganizationId                         = var.aws_organization_id
        SARAccountId                              = var.sar_account_id

        # Test container
        TestImageRepositoryNames                 = var.test_image_repository_names
        TestImageRepositoryUri                   = var.test_image_repository_uri
        TestReportFormat                         = var.test_report_format
        TestCoverageReportFormat                 = var.test_coverage_report_format
        RunTestContainerInVPC                    = var.run_test_container_in_vpc
        TestComputeType                          = var.test_compute_type
        TestContainerAllowCrossAccountAssumeRole = var.test_container_allow_cross_account_assume_role
        TestStackName                            = var.test_stack_name
        TestStageName                            = var.test_stage_name
        RequireTestContainerSignatureValidation  = var.require_test_container_signature_validation

        # Parallel test container
        ParallelTestComputeType                         = var.parallel_test_compute_type
        ParallelTestCoverageReportFormat                = var.parallel_test_coverage_report_format
        ParallelTestImageRepositoryUri                  = var.parallel_test_image_repository_uri
        ParallelTestReportFormat                        = var.parallel_test_report_format
        ParallelTestStackName                           = var.parallel_test_stack_name
        ParallelTestStageName                           = var.parallel_test_stage_name
        RequireParallelTestContainerSignatureValidation = var.require_parallel_test_container_signature_validation
        RunParallelTestContainerInVPC                   = var.run_parallel_test_container_in_vpc

        # Other test / image repositories
        OneLoginTestImageRepositoryNames = var.one_login_test_image_repository_names
        TrafficTestImageRepositoryUri    = var.traffic_test_image_repository_uri
        StoreTestReportInS3Bucket        = var.store_test_report_in_s3_bucket

        # Canary / deployment strategies
        LambdaCanaryDeployment        = var.lambda_canary_deployment
        ECSCanaryDeployment           = var.ecs_canary_deployment
        StepFunctionsCanaryDeployment = var.step_functions_canary_deployment

        # Notifications / permissions
        SlackNotificationType           = var.slack_notification_type
        ProgrammaticPermissionsBoundary = var.programmatic_permissions_boundary
        RequireManualApproval           = var.require_manual_approval
        CircuitBreaker                  = var.circuit_breaker
        AbortOnCheckovFailure           = var.abort_on_checkov_failure

        # Logging / access logs
        LogRetentionDays                  = var.log_retention_days
        AccessLogsCustomBucketNameEnabled = var.access_logs_custom_bucket_name_enabled

        # Misc pipeline naming / behaviour
        DynamicResourcesPrefix         = var.dynamic_resources_prefix
        PipelineEnvironmentNameEnabled = var.pipeline_environment_name_enabled
        SubEnvironment                 = var.sub_environment
        TruncatedPipelineStackName     = var.truncated_pipeline_stack_name
      },
      var.allowed_services,
    ) : key => value if value != null
  }

  # Common tags (Environment, Owner, Product, System) are applied via the
  # provider `default_tags` block in providers.tf. Only per-env extras remain here.
  tags = var.additional_tags

  capabilities = var.capabilities
}
