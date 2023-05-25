type UrnFdnSub = string;
type ClientId = string;
type SessionId = string;

export interface UserData {
  user_id: UrnFdnSub;
  govuk_signin_journey_id: string;
  session_id: SessionId;
}

export interface TxmaEvent {
  event_id: string;
  timestamp: number;
  timestamp_formatted: string;
  event_name: string;
  client_id: ClientId;
  user: UserData;
}

export interface Activity {
  type: string;
  client_id: string;
  timestamp: number;
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
];
