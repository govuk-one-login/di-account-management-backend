type UrnFdnSub = String;
type ClientId = String;

export interface UserRecordEvent{
    TxmaEventBody:  TxmaEventBody,
    ServiceList :  Service []

}
  export interface Service {
    client_id: ClientId;
    count_successful_logins: Number;
    last_accessed: Date;
}
export interface TxmaEventBody {
    event_name: String;
    timestamp: Date;
    client_id: ClientId;
    component_id: String; 
    user: UserData;
  }
  interface UserData {
    "user_id": UrnFdnSub
  }
  export interface UserServices {
    user_id: UrnFdnSub;
    services: Service[];
  }