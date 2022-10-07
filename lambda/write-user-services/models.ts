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

export function isService(o: any): o is Service {
  const service = o as Service;
  return (
    "client_id" in o &&
    "count_successful_logins" in o &&
    "last_accessed" in o &&
    service.last_accessed instanceof Date
  );
}

export function isUserServices(o: any): o is UserServices {
  return "user_id" in o && "services" in o && isService(o.services);
}
