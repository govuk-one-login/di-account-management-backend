FROM nikolaik/python-nodejs:python3.9-nodejs20

WORKDIR /app

USER root

RUN pip3 install aws-sam-cli
RUN pip3 install awscli
RUN pip3 install awscli-local
RUN pip3 install aws-sam-cli-local
RUN npm install -g esbuild
RUN npm install -g wait-on

COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./template.yaml ./
COPY ./src ./src
COPY report-suspicious-activity-asl.json ./

RUN sam build --manifest package.json

ENV AWS_ENDPOINT_URL=http://localstack:4566
CMD wait-on http://localstack:4566 && samlocal deploy --stack-name account-mgmt-backend --region eu-west-2 --resolve-s3