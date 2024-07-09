FROM amazonlinux:2023

ENV AWS_PAGER=""

RUN yum install -y awscli

COPY . .
COPY /post-deploy-tests/run-tests.sh .

ENTRYPOINT ["/run-tests.sh"]
