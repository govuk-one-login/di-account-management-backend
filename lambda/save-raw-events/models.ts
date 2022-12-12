type UrnFdnSub = string;
type ClientId = string;

export interface TxmaEvent {
  event_id: string;
  timestamp: number;
  timestamp_formatted: string;
  event_name: string;
  client_id: ClientId;
  user: UserData;
}

export interface UserData {
  user_id: UrnFdnSub;
  govuk_signin_journey_id: string;
}
