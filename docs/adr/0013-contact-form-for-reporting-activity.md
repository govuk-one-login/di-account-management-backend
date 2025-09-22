# 0013 Use the GOV.UK One Login contact form for reporting activity

## Decision

We will route users to a sub-section of the GOV.UK One Login contact form when they want to report suspicious activity.
We will not record the 'reported status' of each activity in DynamoDB or build screens in One Login Home to allow users to report one or multiple events.

## Context

The previously designed solution tracked the status of each event for a user and raised tickets in Zendesk which would be triaged to the Fraud team. The Fraud team don't use Zendesk as their case management tool so passing these reports on could be time-consuming.

We are also moving away from Zendesk for user support in favour of the contact centre tooling which integrates with Service Now.
We should avoid creating new dependencies on Zendesk. The public contact form has already been updated to report into Service Now, and supports deep linking so we can direct users to the relevant sub-section.

## Consequences

- We are unable to provide the suspicious event IDs to the Fraud team
- We can remove the code supporting the previous solution from our frontend and backend
- Users can't see that they've reported an event in their One Login Home
