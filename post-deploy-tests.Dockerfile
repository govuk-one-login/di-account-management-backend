FROM amazonlinux:2023

ENV AWS_PAGER=""

RUN yum install -y awscli

COPY /post-deploy-tests/run-tests.sh .
COPY /post-deploy-tests/fixtures .

ENTRYPOINT ["/run-tests.sh"]
