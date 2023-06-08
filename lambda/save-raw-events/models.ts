type UrnFdnSub = string;
type ClientId = string;
type SessionId = string;

export interface TxmaEvent {
  event_id: string;
  timestamp: number;
  event_name: string;
  client_id: ClientId;
  user: UserData;
}

export interface UserData {
  user_id: UrnFdnSub;
  session_id: SessionId;
}
