export interface UserData {
  user_id: string;
}

export interface Activity {
  type: string;
  client_id: string;
  timestamp: number;
}

export interface ActivityLogEntry {
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  activities: Activity[];
  truncated: boolean;
}
