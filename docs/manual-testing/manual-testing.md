# Manually testing the Account Management backend

## Activity Log

### Triggering the query, format and write lambda functions

The activity log is not connected to the raw_event_store as it is not ready to be used in production.
Instead, the lambdas to query, format and write an activity record are triggered by saving an event into the dummy-event table.

To insert a new event into the DB:

`gds aws di-account-dev -- aws dynamodb put-item --table-name dummy_events --region eu-west-2 --item file:////./docs/manual-testing/dummy-activity-event.json`

Timestamp, client_id, user.user_id, and session_id are the fields you are likely going to want to customise in dummy_activity_event.json.
