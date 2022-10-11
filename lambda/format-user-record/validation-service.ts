import { SQSRecord } from 'aws-lambda';

export class ValidationService {
    static async validateSQSRecord(record: SQSRecord): Promise<Boolean> {
        const message = record.body;
        return true;
    }
}