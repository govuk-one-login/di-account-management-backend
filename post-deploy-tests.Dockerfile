FROM amazonlinux:2023.12.20260611.0

ENV AWS_PAGER=""

RUN yum install -y awscli jq

COPY /post-deploy-tests/run-tests.sh .
COPY /post-deploy-tests/fixtures .

ENTRYPOINT ["/run-tests.sh"]
