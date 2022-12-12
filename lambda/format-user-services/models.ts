type UrnFdnSub = string;
type ClientId = string;

export interface UserRecordEvent {
  TxmaEvent: TxmaEvent;
  ServiceList: Service[];
}

export interface Service {
  client_id: ClientId;
  count_successful_logins: number;
  last_accessed: string;
}

export interface TxmaEvent {
  event_name: string;
  timestamp: string;
  client_id: ClientId;
  user: UserData;
}

export interface UserData {
  user_id: UrnFdnSub;
}

export interface UserServices {
  user_id: UrnFdnSub;
  services: Service[];
}
