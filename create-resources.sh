awslocal secretsmanager create-secret --name dynatrace --secret-string '{"DT_CONNECTION_AUTH_TOKEN":"0000", "DT_CONNECTION_BASE_URL": "0000", "DT_CLUSTER_ID": "0000", "DT_LOG_COLLECTION_AUTH_TOKEN": "00000", "DT_TENANT": "00000", "NODEJS_LAYER": "00000"}' --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-group-id --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-tags --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-api-token --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-api-user-key --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-api-url-key --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name zendesk-api-ticket-form-id-key --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name notify-api-key --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name /account-mgmt-backend/Config/Storage/VerificationSecret --secret-string "0000" --region eu-west-2
awslocal secretsmanager create-secret --name /account-mgmt-frontend/Config/Publishing/API/Key --secret-string "0000" --region eu-west-2

samlocal deploy --stack-name account-mgmt-backend --region eu-west-2 --resolve-s3 --parameter-overrides "Environment=local"