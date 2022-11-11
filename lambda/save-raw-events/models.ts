type UrnFdnSub = string;
type ClientId = string;
type EventId = string;

export interface TxmaEvent {
  event_name: string;
  timestamp: string;
  client_id: ClientId;
  component_id: string;
  user: UserData;
}

export interface UserData {
  user_id: UrnFdnSub;
}

interface RawEventDocument {
  id: EventId;
  timestamp: number;
  event: string;
}
