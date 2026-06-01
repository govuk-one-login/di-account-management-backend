FROM amazonlinux:2023.11.20260526.0

ENV AWS_PAGER=""

RUN yum install -y awscli jq

COPY /post-deploy-tests/run-tests.sh .
COPY /post-deploy-tests/fixtures .

ENTRYPOINT ["/run-tests.sh"]
