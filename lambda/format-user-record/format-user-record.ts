import { SendMessageCommand, SendMessageRequest, SQSClient } from '@aws-sdk/client-sqs';
import { SQSEvent, SQSRecord } from 'aws-lambda';
import { UserRecordEvent, Service, UserServices } from './models';

const QUEUE_URL = "";
const AWS_REGION = process.env.AWS_REGION;

export const handler = async (event: SQSEvent): Promise<void> => {
    for (const record of event.Records) {
        //validate the record
        const validationResponse = await validateSQSRecord(record as SQSRecord);
        if (!validationResponse) {
            console.log("[ERROR] Validation error ")
        }
        else {
            const userRecordEvent: UserRecordEvent =  JSON.parse(record.body);
            for(const service of userRecordEvent.ServiceList){ 
                if(await  matchService(service,userRecordEvent)){
                    updateServiceDetails(service,userRecordEvent)
                    
                }
                else {
                    addNewService(userRecordEvent);
                    break;
                }
        }
          const messageId =  await  sendSqsMessage(createUserService(userRecordEvent),QUEUE_URL);
          console.log("[Message sent to QUEUE] with message id = " + messageId);
        }    
    }
};

export const matchService = async (service: Service, userRecordEvent: UserRecordEvent): Promise<Boolean> =>{  
        return (service.client_id === userRecordEvent.TxmaEventBody.client_id);
   } ; 
  
export const updateServiceDetails =async (service: Service, userRecordEvent: UserRecordEvent) => {
    service.count_successful_logins = service.count_successful_logins.valueOf() + 1;
    service.last_accessed = userRecordEvent.TxmaEventBody.timestamp;
}

export const addNewService = async (userRecordEvent: UserRecordEvent) => {
    const newService:Service = { 
        client_id: userRecordEvent.TxmaEventBody.client_id,
        count_successful_logins: 1,
        last_accessed: userRecordEvent.TxmaEventBody.timestamp
    };    
    userRecordEvent.ServiceList.push(newService); 
}

export const createUserService = async (userRecordEvent: UserRecordEvent): Promise<UserServices> => {
    const userService:UserServices = {
        user_id : userRecordEvent.TxmaEventBody.user.user_id,
        services: userRecordEvent.ServiceList
    };

    return userService;
}

export const validateSQSRecord = async(record: SQSRecord): Promise<Boolean> => {
    return true;
}
export const sendSqsMessage = async (
    messageBody: object,
    queueUrl: string
  ): Promise<string | undefined> => {
    const client = new SQSClient({ region: AWS_REGION})
    const message: SendMessageRequest = {
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(messageBody)
    }
    const result = await client.send(new SendMessageCommand(message))
    return result.MessageId
  }

