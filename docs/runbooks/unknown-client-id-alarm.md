# UnknownClientIdAlarm Runbook

## What is this alarm?

An anomaly detection alarm that fires when the daily count of unknown client IDs received by `format-activity-log` or `format-user-services` is significantly higher than the learned baseline.

An "unknown client ID" is one that appears in TxMA events but is not in the RP registry (`src/common/registeredRPs.ts`).

## Impact

Low. Unknown client IDs do not cause processing failures — the events continue through the pipeline. However, a spike may indicate:

- A new relying party has gone live without being added to the registry
- A misconfigured client is sending events with an incorrect client_id
- A previously-decommissioned client has reappeared

## Investigation

1. Check which client IDs triggered the metric in the last 24 hours:

   [Dynatrace Data Explorer - Unknown Client IDs (last 24h)](https://bhe21058.live.dynatrace.com/ui/data-explorer?gf=all&gtf=-24h+to+now#eyJ2ZXJzaW9uIjoyLCJjb25maWciOnsiYm91bmRzIjp7fSwiY29uZmlndXJlZCI6ZmFsc2UsImVkaXRhYmxlIjp0cnVlLCJuYW1lIjoiRGF0YSBleHBsb3JlciByZXN1bHRzIiwidGlsZVR5cGUiOiJEQVRBX0VYUExPUkVSIiwiY3VzdG9tTmFtZSI6IkRhdGEgZXhwbG9yZXIgcmVzdWx0cyIsInF1ZXJpZXMiOlt7ImlkIjoiQSIsImVuYWJsZWQiOnRydWUsImZpbHRlckJ5Ijp7ImZpbHRlck9wZXJhdG9yIjoiQU5EIiwiY3JpdGVyaWEiOltdLCJuZXN0ZWRGaWx0ZXJzIjpbeyJmaWx0ZXIiOiJhd3MuYWNjb3VudC5pZCIsImZpbHRlclR5cGUiOiJESU1FTlNJT04iLCJmaWx0ZXJPcGVyYXRvciI6Ik9SIiwibmVzdGVkRmlsdGVycyI6W10sImNyaXRlcmlhIjpbeyJ2YWx1ZSI6IjAyNjk5MTg0OTkwOSIsImV2YWx1YXRvciI6IkVRIn1dfV19LCJsaW1pdCI6MjAsInJhdGUiOiJOT05FIiwic29ydEJ5IjoiREVTQyIsInNvcnRCeURpbWVuc2lvbiI6IiIsInNwYWNlQWdncmVnYXRpb24iOiJDT1VOVCIsInRpbWVTaGlmdCI6eyJ1bml0IjoiREFZIn0sInNwbGl0QnkiOlsiY2xpZW50aWQiXSwibWV0cmljIjoiY2xvdWQuYXdzLmFjY291bnQtbWFuYWdlbWVudC1iYWNrZW5kLnVua25vd25DbGllbnRJZFJlY2VpdmVkQnlBY2NvdW50SWRSZWdpb25jbGllbnRJZHNlcnZpY2UiLCJoaXN0b2dyYW0iOmZhbHNlfV0sInZpc3VhbENvbmZpZyI6eyJ0aHJlc2hvbGRzIjpbeyJ2aXNpYmxlIjp0cnVlLCJydWxlcyI6W3siY29sb3IiOiIjN2RjNTQwIn0seyJjb2xvciI6IiNmNWQzMGYifSx7ImNvbG9yIjoiI2RjMTcyYSJ9XSwicXVlcnlJZCI6IkEiLCJjb2x1bW5JZCI6IiJ9XSwiZ2xvYmFsIjp7fSwicnVsZXMiOltdLCJ0eXBlIjoiVEFCTEUiLCJoZWF0bWFwU2V0dGluZ3MiOnsieUF4aXMiOiJWQUxVRSIsInNob3dMYWJlbHMiOmZhbHNlfSwiaG9uZXljb21iU2V0dGluZ3MiOnsic2hvd0xlZ2VuZCI6dHJ1ZSwic2hvd0hpdmUiOnRydWV9LCJncmFwaENoYXJ0U2V0dGluZ3MiOnsiY29ubmVjdE51bGxzIjpmYWxzZX0sInNpbmdsZVZhbHVlU2V0dGluZ3MiOnsic2hvd1RyZW5kIjp0cnVlLCJzaG93U3BhcmtMaW5lIjp0cnVlLCJsaW5rVGlsZUNvbG9yVG9UaHJlc2hvbGQiOnRydWV9LCJpc1RhYmxlUGFnaW5hdGlvbkVuYWJsZWQiOmZhbHNlLCJ0YWJsZVNldHRpbmdzIjp7ImhpZGRlbkNvbHVtbnMiOlsiQTpjbGllbnRpZC5uYW1lIl19fSwicXVlcmllc1NldHRpbmdzIjp7InJlc29sdXRpb24iOiIifSwiYmFzZWxpbmVDb25maWdzIjpbXX19)

2. Search Jira for the client ID to identify whether it's a known relying party that simply hasn't been added to the registry yet.

3. Check with the onboarding team whether a new RP has recently gone live.

## Resolution

- **New legitimate RP**: Add the client ID to the RP registry in `src/common/registeredRPs.ts`.
- **Misconfigured client**: Raise with the onboarding team to correct their client_id.
- **Transient spike**: If the alarm self-resolves and the client IDs are known low-level noise, no action needed. Some RPs test with their client IDs before their official go-live date, which may account for temporary spikes.
