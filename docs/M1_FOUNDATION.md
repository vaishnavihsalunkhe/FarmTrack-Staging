# M1-01 / M1-02 — isolated development baseline

Baseline: FarmTrack-Staging commit \`522be0acf4ea13072985344c34c403af5ae48810\` (M0 phone acceptance).
Development branch: \`m1-indexeddb-foundation\`.
Production FarmTrack and staging main application are unchanged.

## Folder layout

- \`src/m1/migration.mjs\`: pure legacy-data validation and deterministic IDs
- \`src/m1/storage.mjs\`: versioned IndexedDB connection and atomic migration
- \`tests/m1-migration.test.mjs\`: isolated migration regression tests

## Database contract

Database \`farmtrack-staging-m1\`, version 1.
Stores: crops, events, expenses, notes, schemes, prices (keyPath \`id\`), metadata (keyPath \`key\`).
No production-origin key is read; only \`farmtrack_staging_v1\` is eligible for migration.
Original localStorage is retained as-is. Invalid/duplicate records reject the migration.
Original legacy snapshot is stored within the same transaction and is never dispatched to a backend.

## Activation gate

Not wired into \`index.html\` yet. Before activation:
- Complete browser IndexedDB integration and transaction/upgrade/error tests;
- test corrupted storage, duplicate IDs, multiple tabs and retries;
- verify record-by-record count and monetary reconciliation;
- test migration and export/restore on Android in isolated staging;
- obtain review approval before any new default storage behavior.

## Rollback

Leave localStorage records untouched. Since the live UI continues using localStorage,
a developer can simply deploy the known-good staging main baseline. Do not clear user storage.
