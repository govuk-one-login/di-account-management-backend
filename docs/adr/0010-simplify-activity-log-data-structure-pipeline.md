# Simplify activity log data structure & pipeline

## Decision

We will change the activity log data structure to store each event as a separate item in DynamoDB.

We will encrypt the `event_type` attribute on each item to preserve user privacy.

We will add a new secondary index on `event_id` to allow us to query DynamoDB for individual events.

The new structure for each item in DynamoDB will be:

```typescript
interface EncryptedActivityLogEntry {
  event_type: string;
  session_id: string;
  user_id: string;
  timestamp: number;
  client_id: string;
  reported_suspicious: boolean;
}
```

This data structure is much simpler than before which allows us to simplify the pipeline.
We no longer need to query DynamoDB for an existing item before updating it, so we can remove the `query-activity-log` Lambda.
We will subscribe the `format-activity-log` Lambda to the raw events DynamoDB stream.

The new architecture will be:

![Architectural design diagram showing the removal of the query lambda](images/ADR-0010-simplified-activity-log-architecture.png)

## Context

In [ADR 0006](./0006-recording-activity-log-data-within-the-account.md) we decided on a data structure for the activity log.
This used one item in DynamoDB per user and session which had an attribute with a list of events for the session.

We decided on this structure to minimise the number of items in the table as we weren't sure how fast DynamoDB would be when querying a table with many many items.
Results from other teams show we don't need to worry about this - DynamoDB is plenty fast enough with the right indices.

Since the original design, we have also had a new requirement for this feature, as well as discussions about potential future requirements.
We may need to allow users to report individual events, or multiple events at once, rather than reporting a whole session.

A simpler data structure where each event is a separate item allows us to be more flexible in how we meet this and future requirements.
We could use this single table with all relevant event data to power all planned and current features of the account home application, including service cards.

This may allow us to migrate users' data from the existing user services table into this new structure and further simplify our backend.

## Consequences

- We will need to do extra work in our backend to remove the `query-activity-log` lambda.
- Querying for a user's activity in the frontend will be simpler.
- We will be able to add new attributes to stored events more easily, speeding up future work.
- We will be able to use DynamoDB to sort and filter events rather than writing our own code in the application
