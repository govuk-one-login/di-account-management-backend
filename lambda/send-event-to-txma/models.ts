export interface TxmaEvent {
  event_name: string;
  component_id: string;
  user: UserData;
  extensions: Extensions;
}

export interface UserData {
  user_id: string;
  session_id: string;
  persistent_session_id: string;
}
export interface Extensions {
  reported_session_id: string;
}

export interface CurrentTimeDescriptor {
  isoString: string;
  milliseconds: number;
  seconds: number;
}

export interface ReportedEvent {
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  activities: ReportedActivity;
}

export interface SuspiciousActivityEvent {
  user_id: string;
  email_address: string;
  persistent_session_id: string;
  session_id: string;
  reported: boolean;
  reported_event: ReportedEvent;
}

export interface ReportedActivity {
  type: string;
  client_id: string;
  timestamp: number;
  event_id: string;
}
