export interface UserData {
  user_id: string;
  access_token: string;
  email?: string;
  source_ip?: string;
  persistent_session_id?: string;
  session_id?: string;
  public_subject_id: string;
  legacy_subject_id?: string;
  govuk_signin_journey_id: string;
}

export interface Activity {
  type: string;
  client_id: string;
  timestamp: number;
}

export interface TxmaEvent {
  event_id: string;
  event_name: string;
  timestamp: number;
  timestamp_formatted: string;
  client_id: string;
  user: UserData;
}

export interface ActivityLogEntry {
  event_id: string;
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  client_id: string;
  reported_suspicious: boolean;
}

export const allowedTxmaEvents: Array<string> = [
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
];

export const REPORT_SUSPICIOUS_ACTIVITY_DEFAULT = false;
