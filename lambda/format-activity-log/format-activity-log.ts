import { SQSEvent } from 'aws-lambda';
import { ActivityLogEntry, UserActivityLog } from './models';

export const handler = async (event: SQSEvent): Promise<void> => {

};

export const formatIntoActivitLogEntry = (userActivityLog : UserActivityLog ) 
    : ActivityLogEntry => {
        if 
    return userActivityLog.ActivityLogEntry;
};
