# Cross Program Event Stream for accounts

## Summary

- GOV.UK Account team has agreed to work with TxMA to gain access to cross program data.
- GOV.UK Account will consume a queue provided and maintained by TxMA.
- The queue will provide one event: `AUTH_AUTH_CODE_ISSUED`.
- This supports the "Services you have used" feature.
- We can expand this to other events in future, if there is a need.

This ADR is a stub pointing to the cross program decision.

## Context

This decision has cross program implications and is stored in the [Architecture Repository](https://github.com/alphagov/digital-identity-architecture) for cross program review.

See [alphagov/digital-identity-architecture#279](https://github.com/alphagov/digital-identity-architecture/pull/279) - TxMA Event stream for Account Relevant events

For a list of available cross program events see: [Cross Program Event list](https://docs.google.com/spreadsheets/d/1cLjAdRcpw94uYLnrt7FTeFX5XM_7MLRTDWdf-Zbobj8/edit#gid=2084726467) (Google sheets - permission may be required)
