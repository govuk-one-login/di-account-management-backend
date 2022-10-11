type UrnFdnSub = String;
type ClientId = String;

export interface UserServices {
  user_id: UrnFdnSub;
  services: Service[];
}

export interface Service {
  client_id: ClientId;
  count_successful_logins: Number;
  last_accessed: Date;
}
