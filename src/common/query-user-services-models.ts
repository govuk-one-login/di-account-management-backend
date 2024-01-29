type UrnFdnSub = string;
type ClientId = string;

export interface UserServices {
  user_id: UrnFdnSub;
  services: Service[];
}

export interface TxmaEvent {
  event_id: string;
  timestamp: number;
  event_name: string;
  client_id: ClientId;
  user: UserData;
}
export interface Service {
  client_id: ClientId;
  count_successful_logins: number;
  last_accessed: number;
  last_accessed_pretty: string;
}

export interface UserData {
  user_id: UrnFdnSub;
}

export interface UserRecordEvent {
  TxmaEvent: TxmaEvent;
  ServiceList: Service[];
}
