type UrnFdnSub = string;
type ClientId = string;

export interface UserRecordEvent {
  TxmaEventBody: TxmaEventBody;
  ServiceList: Service[];
}

export interface Service {
  client_id: ClientId;
  count_successful_logins: number;
  last_accessed: Date;
}

export interface TxmaEventBody {
  event_name: string;
  timestamp: Date;
  client_id: ClientId;
  component_id: string;
  user: UserData;
}

interface UserData {
  user_id: UrnFdnSub;
}

export interface UserServices {
  user_id: UrnFdnSub;
  services: Service[];
}
