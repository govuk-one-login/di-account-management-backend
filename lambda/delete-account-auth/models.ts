export interface SNSMessage {
  email: string;
  token: string;
  sourceIp: string;
  persistentSessionId: string;
  sessionId: string;
}
