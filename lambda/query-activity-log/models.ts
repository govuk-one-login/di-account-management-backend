export interface UserData {
  user_id: string;
  govuk_signin_journey_id: string;
  session_id: string;
}

export interface TxmaEvent {
  event_id: string;
  timestamp: number;
  timestamp_formatted: string;
  event_name: string;
  client_id: string;
  user: UserData;
}

export interface Activity {
  type: string;
  client_id: string;
  timestamp: number;
  event_id: string;
}

export interface ActivityLogEntry {
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  activities: Activity[];
  truncated: boolean;
}

export interface UserActivityLog {
  txmaEvent: TxmaEvent;
  activityLogEntry: ActivityLogEntry | undefined;
}

export const allowedTxmaEvents: Array<string> = [
  "AUTH_AUTH_CODE_ISSUED",
  "AUTH_IPV_AUTHORISATION_REQUESTED",
  "AUTH_IPV_SUCCESSFUL_IDENTITY_RESPONSE_RECEIVED",
];
