# pre-merge-integration-tests/template
## Description
Github action role for testing CloudFormation stack status.


### Parameters
The list of parameters for this template:

| Parameter        | Type   | Default   | Description |
|------------------|--------|-----------|-------------|
| OneLoginRepositoryName | String |  | The name of Repo which is allowed to push here. |

### Resources
The list of resources this template creates:

| Resource         | Type   |
|------------------|--------|
| LockToRegionPolicy | AWS::IAM::ManagedPolicy |
| CloudFormationStackTestingGitHubActionsPolicy | AWS::IAM::ManagedPolicy |
| CloudFormationStackTestingGitHubActionsRole | AWS::IAM::Role |

### Outputs
The list of outputs this template exposes:

| Output           | Description   |
|------------------|---------------|
| GitHubActionRoleArn | The resource used by GitHub Actions for testing cloudformation stack. |
