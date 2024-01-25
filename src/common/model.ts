export interface UserData {
  user_id: string;
  email?: string;
  session_id?: string;
  persistent_session_id?: string;
  govuk_signin_journey_id?: string;
  access_token?: string;
  source_ip?: string;
  public_subject_id?: string;
  legacy_subject_id?: string;
  reported?: boolean;
  reported_event?: ReportedEvent;
}

export interface Service {
  client_id: string;
  count_successful_logins: number;
  last_accessed: number;
  last_accessed_pretty: string;
}

export interface UserServices {
  user_id: string;
  services: Service[];
}

export interface UserRecordEvent {
  TxmaEvent: TxmaEvent;
  ServiceList: Service[];
}

export interface TxmaEvent {
  event_id?: string;
  client_id?: string;
  timestamp: number;
  event_timestamp_ms?: number;
  timestamp_formatted?: string;
  event_timestamp_ms_formatted?: string;
  event_name: string;
  // TODO: According to the RFC this should be mandatory
  component_id?: string;
  user: UserData;
  extensions?: Extensions;
}

export interface Extensions {
  reported_session_id: string;
}

export interface CurrentTimeDescriptor {
  isoString: string;
  milliseconds: number;
  seconds: number;
}

export interface ReportedActivity {
  type: string;
  client_id: string;
  timestamp: number;
  event_id: string;
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

export interface ActivityLogEntry {
  event_id: string;
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  client_id: string;
  reported_suspicious: boolean;
}

export interface EncryptedActivityLogEntry {
  event_id: string;
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  client_id: string;
  reported_suspicious: boolean;
}
