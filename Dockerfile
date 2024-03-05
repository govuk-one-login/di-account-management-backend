FROM nikolaik/python-nodejs:python3.9-nodejs20

WORKDIR /app
RUN pip install aws-sam-cli
RUN pip install awscli-local
RUN npm install -g esbuild

COPY package.json ./
COPY package-lock.json ./
COPY tsconfig.json ./

RUN npm install

COPY ./template.yaml ./
COPY ./src ./src

RUN sam build

CMD ["awslocal", "cloudformation", "create-stack" "--template-file", "/app/template.yml", "--stack-name", "account-mgmt-backend"] 