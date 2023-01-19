import {SNSEvent} from "aws-lambda";
import axios, {AxiosRequestConfig, AxiosResponse} from "axios";
import {aws4Interceptor} from "aws4-axios";
import {SNSMessage} from "./models";

export function getRequestConfig(token: string): AxiosRequestConfig {
    const config: AxiosRequestConfig = {
        headers: {
            Authorization: `Bearer ${token}`,
        },
        proxy: false,
    };
    return config;
}

export const validateSNSMessage = (snsMessage: SNSMessage): SNSMessage => {
    if (!snsMessage.public_subject_id) {
        throw new Error(
            `SNS Message is missing required attribute "public_subject_id". ${JSON.stringify(
                snsMessage
            )}`
        );
    }
    return snsMessage;
};

async function sendRequest(snsMessage: SNSMessage) {
    console.log("Sending DELETE request to GOV.UK Subscriptions API.");

    const interceptor = aws4Interceptor({
        region: "eu-west-2",
        service: "execute-api",
    });

    axios.interceptors.request.use(interceptor);

    const token: string = process.env.GOV_ACCOUNTS_PUBLISHING_API_TOKEN!;
    const requestConfig = getRequestConfig(token);
    let deleteUrl = `${process.env.MOCK_PUBLISHING_API_URL}/api/oidc-users/${snsMessage.public_subject_id}`;
    // let deleteUrl = `account-api.staging.publishing.service.gov.uk/api/oidc-users/${snsMessage.public_subject_id}`;
    if (snsMessage.legacy_subject_id) {
        deleteUrl = `${deleteUrl}?legacy_sub=${snsMessage.legacy_subject_id}`;
    }

    console.log(
        `Request config: ${JSON.stringify(requestConfig)}, URL: ${deleteUrl}`
    );

    try {
        const response: AxiosResponse = await axios.delete(
            deleteUrl,
            requestConfig
        );

        const responseObject = {
            status: response.status,
            statusText: response.statusText,
        };

        console.log(`Response from GOV.UK API: ${JSON.stringify(responseObject)}`);

        return responseObject;
    } catch (error: any) {
       console.log(
            `Unable to successfully send DELETE request to GOV.UK. Error:${error}`
        );
        throw Error(error)
    }
}

export const handler = async (event: SNSEvent): Promise<void> => {
    console.log(`SNS Event: ${JSON.stringify(event)}`);

    await Promise.all(
        event.Records.map(async (record) => {
            const snsMessage: SNSMessage = JSON.parse(record.Sns.Message);
            console.log(`Parsed SNS Message: ${JSON.stringify(snsMessage)}`);
            validateSNSMessage(snsMessage);
            await sendRequest(snsMessage);
        })
    );
};
