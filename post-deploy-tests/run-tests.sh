#!/bin/bash

# Script to run post-deploy tests in the build environment
# See https://govukverify.atlassian.net/wiki/spaces/PLAT/pages/3054010402/How+to+run+tests+against+your+deployed+application+in+a+SAM+deployment+pipeline 
# for more information as to how this is used

# Exit the script with error code 1 if any command fails
set -euxo pipefail

aws lambda invoke \
  --function-name build-account-mgmt-backend-write-activity-log:live \
  --payload "$(cat /write-activity-log.json | base64)" \
  --output json \
  /dev/null | jq -e -n 'if input.StatusCode == 200 then true else halt_error(1) end'

aws lambda invoke \
  --function-name build-account-mgmt-backend-delete-activity-log:live \
  --payload "$(cat /delete-activity-log.json | base64)" \
  --output json \
  /dev/null | jq -e -n 'if input.StatusCode == 200 then true else halt_error(1) end'
