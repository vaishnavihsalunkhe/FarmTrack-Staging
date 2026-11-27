# M1-07 — Migration and release readiness

## Scope
Development branch only. No production or staging-main rollout. The full M1 app is a proof-of-concept; migration into the existing production installation remains **disabled**.

## Migration approach
- Import requires an **explicitly supplied** JSON backup, not a hidden lookup of `farmtrack_v1` or `farmtrack_staging_v1`.
- The M1 migration lab is for **synthetic records only**. Do not upload genuine farmer backups to a GitHub Pages development origin: all repos under the same `github.io` host share an origin.
- Validate the object structure, IDs and financial values, then compute a before/after reconciliation report in integer paise.
- Treat event-linked sale expenses as legacy duplicates and never count them as farming costs or additional revenue.
- Generate deterministic IDs for legacy records that lack them; preserve all other fields.
- Reject migration into an occupied development database.
- Store the raw original backup, reconciliation report and migrated state in a single IndexedDB transaction.
- Do not modify localStorage during import.

## Release blockers
1. Chromium and Node suites succeed for the same M1 commit.
2. Test with crop, event, linked-sale, expense, note, market and scheme fixtures.
3. Compare individual records, field links, counts, expense/revenue/net totals and backup source.
4. Test malformed JSON, missing arrays, duplicate IDs, interrupted transactions and occupied databases.
5. Confirm browser reload, offline launch, navigation and finance behavior on Android.
6. Verify development data does not access or mutate production or staging localStorage keys.
7. Independently test rollback to the last working app without clearing or deleting user data.
8. Obtain explicit release approval before changing production.

## Rollback
The tested M1 build retains the original JSON backup in the development IndexedDB transaction. If migration testing fails, do not delete IndexedDB or clear browser storage. Restore the known-good static app code only after saving current state and verifying the legacy backup. Git rollback alone does not restore browser-owned records.

## Known limitations
- This is a development-only **full-state snapshot** IndexedDB adapter, not yet normalized per-entity stores.
- The UI still has historical synchronous editing patterns; persistent writes must be independently checked for failures and concurrent writes.
- Shared `github.io` origin means storage namespaces are separate but not a hard origin boundary.
- This phase does **not** authorize real farmer backup import into M1 Dev.
