# Reduce backup costs for activity log data

## Decision

We will reduce the backup frequency of the `activity_log` DynamoDB table from bihourly to daily, and introduce a 12-month TTL on it.

These two changes together significantly reduce our AWS Backup costs while maintaining our disaster recovery capabilities. The TTL will be implemented in a follow-up change.

## Context

The `activity_log` table grows continuously and has no expiry mechanism. As the GOV.UK One Login user base grows, this table's size — and consequently its backup costs — are increasing at an accelerating rate. An analysis of the production table ([OLH-3559](https://govukverify.atlassian.net/browse/OLH-3559)) informed the options below. See that ticket for detailed cost projections and data analysis.

The `activity_log` table is currently tagged `BackupFrequency: Bihourly`, which causes [backup-as-a-service](https://github.com/govuk-one-login/backup-as-a-service) to take 12 snapshots per day. Combined with 7-day local retention (84 concurrent recovery points) and 15-day central retention (~180 concurrent recovery points), this results in significant and growing storage costs.

The bihourly frequency was selected when backups were first enabled ([OLH-2839](https://govukverify.atlassian.net/browse/OLH-2839)) as part of the backup-as-a-service rollout. Given the redundancy with PITR (see below), daily frequency is sufficient for our recovery needs.

Critically, the `activity_log` table already has **Point-in-Time Recovery (PITR) enabled**, which provides second-precision restore for 35 days. Since snapshot retention is only 7 days (local) / 15 days (central), PITR fully overlaps the snapshot coverage for disaster recovery. The only additional value of snapshots is the cross-account copy — which provides recovery if the original table resources in the primary account cannot be used. For that purpose, daily frequency provides the same assurance.

## Options considered

### Option 1: Do nothing

Backup costs continue to grow proportionally with table size and volume. Projected costs increase by over 80% in the next 12 months.

### Option 2: Reduce backup frequency to daily (chosen)

Change the `BackupFrequency` tag from `Bihourly` to `Daily`. This reduces recovery points from 84 to 7 (local) and 180 to 15 (central) — a 12× reduction in stored backup data.

PITR continues to provide fine-grained restore. Daily snapshots still provide cross-account recovery if the original resources cannot be used. In that scenario, audit events can be replayed to bring the data up to date later in the day.

Projected saving: approximately 92% reduction in backup costs over the next year.

### Option 3: Add a 12-month TTL to the activity_log table (chosen)

Introduce a TTL attribute that expires items older than 12 months. Analysis of the production table confirms:

- The vast majority of items are less than 12 months old
- A 12-month TTL would remove a modest proportion of current items, with savings growing over time as new data ages out
- Only dormant users (those who haven't interacted for over 12 months) would lose their activity history
- Active users experience negligible impact (median items per user unchanged)

This prevents unbounded table growth and reduces each backup recovery point proportionally. Projected saving: approximately 34% reduction in backup costs over the next year.

### Option 4: Remove encryption of event_type attribute (discounted)

Would reduce item size but programme [ADR 0122](https://github.com/govuk-one-login/architecture/blob/main/adr/0122-secure-storage-accounts-data.md) requires we keep it.

### Option 5: Delete unused SessionIdIndex GSI (separate change)

The `SessionIdIndex` GSI was created for a lambda that was later removed ([ADR 0010](./0010-simplify-activity-log-data-structure-pipeline.md)). No application code queries it. However, [AWS Backup does not store GSI data separately](https://repost.aws/articles/AR81FUSqA6TBKQuEeDM8S8BQ/dynamodb-gsi-backups-cost-functionality-when-using-aws-backups), so deleting it saves live storage costs only — not backup costs. This will be addressed separately.

## Consequences

- Backup frequency changes from every 2 hours to once daily at 09:00 UTC
- The worst-case data loss from the cross-account backup increases from 2 hours to 24 hours — but PITR in the primary account still provides second-precision recovery for 35 days
- New items written to `activity_log` will include a `ttl` attribute set to 12 months from the event timestamp
- Existing items without a `ttl` attribute will not be automatically expired — a backfill strategy will be needed for retroactive cleanup
- The table will stabilise in size rather than growing indefinitely

Note: This change implements the backup frequency reduction. The TTL will be implemented in a follow-up change. Combined, both changes are projected to reduce backup costs by approximately 95% over the next year.
