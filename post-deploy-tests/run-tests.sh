#!/bin/bash

# Script to run post-deploy tests in the build environment
# See https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3054010402/How+to+run+tests+against+your+deployed+application+in+a+SAM+deployment+pipeline 
# for more information as to how this is used

# Exit the script with error code 1 if any command fails
set -euxo pipefail

check_lambda_invocation () {
  aws lambda invoke \
    --function-name build-account-mgmt-backend-$1:live \
    --payload "$(cat /$1.json | base64)" \
    --output json \
    /dev/null | jq -e -n 'if input.StatusCode == 200 then true else halt_error(1) end'
}

for lambda_name in write-activity-log delete-activity-log; do
  check_lambda_invocation $lambda_name
done
