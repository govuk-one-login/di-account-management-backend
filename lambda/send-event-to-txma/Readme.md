# Sending events to TxMA

## Summary
- We expect to be sending multiple events to TxMA, so we have built this handler to be re-usable by multiple lambdas. 
- All Lambdas are configured in the AWS SAM template here: [https://github.com/alphagov/di-account-management-backend/blob/main/infrastructure/template.yaml] 

## Key Requirements
- The lambda should validate the fields in the received event
- The lambda should validate the fields in the generated TxMA event
- If validation fails send the message to the DLQ.
-  If validation is a success , the lambda should then send the event to the audit event queue

## How to Re-use this handler for a different lambda

### Infrastructure Changes
- New Lambda will refer to the send-event-txma handler e.g. `CodeUri: ../lambda/send-event-to-txma/`
- Must specify event name as an environment variable because the transformation logic and validation rule is selected by an event name e.g. 
    ``` 
    Environment:
        Variables:
          EVENT_NAME: REPORT_SUSPICIOUS_ACTIVITY_EVENT_NAME
    ```
### Transformation
- Within send-event-to-txma.ts, update the transformation logic to refer to transform the new event.
```
export const transformToTxMAEvent = (event: any, eventName: string): any => {
  let txmaEvent = null;
  if (eventName === EventNamesEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY) {
    .............
  } else {
    throw new Error(
      "Unsupported event - There is no transformation logic for this event"
    );
  }
  return txmaEvent;
};
```

### Validation
- Add new validation rule for the new event, see example validation rule for suspicious activity event
```
ValidationRulesKeyEnum.HOME_REPORT_SUSPICIOUS_ACTIVITY,
  {
    user_id: [(value) => typeof value === "string" && value.length > 0],
    email_address: [(value) => typeof value === "string" && value.length > 0],
    persistent_session_id: [
      (value) => typeof value === "string" && value.length > 0,
    ],
    session_id: [(value) => typeof value === "string" && value.length > 0],
    reported: [(value) => typeof value === "boolean"],
    reported_event: {
      event_type: [
        (value) => typeof value === "string" && value.length > 0,
        (value) => /^[a-zA-Z0-9_]+$/.test(value),
      ],
      session_id: [(value) => typeof value === "string" && value.length > 0],
      user_id: [(value) => typeof value === "string" && value.length > 0],
      timestamp: [(value) => typeof value === "number"],
      activities: {
        type: [(value) => typeof value === "string" && value.length > 0],
        client_id: [(value) => typeof value === "string" && value.length > 0],
        timestamp: [(value) => typeof value === "number"],
        event_id: [(value) => typeof value === "string" && value.length > 0],
      },
    },
  }
);
```

### Testing
- Add unit test for new events validation and transformation.

