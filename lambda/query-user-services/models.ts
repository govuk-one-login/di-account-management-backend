type UrnFdnSub = string;
type ClientId = string;

export interface UserServices {
  user_id: UrnFdnSub;
  services: Service[];
}
export interface TxmaEvent {
  event_name: string;
  timestamp: string;
  client_id: ClientId;
  component_id: string;
  user: UserData;
}
export interface Service {
  client_id: ClientId;
  count_successful_logins: number;
  last_accessed: Date;
}
export interface UserData {
  user_id: UrnFdnSub;
}
export interface UserRecordEvent {
  TxmaEvent: TxmaEvent;
  ServiceList: Service[];
}

export interface RawTxmaEvent {
  remove_at: number;
  id: string;
  timestamp: number;
  event: TxmaEvent;
}
