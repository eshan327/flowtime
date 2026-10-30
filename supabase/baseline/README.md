# Schema baseline

`20261029.json` is a schema-only catalog snapshot of the linked production project's public tables, columns, defaults, constraints, indexes, grants, RLS policies and existing private Auth token hook before the full integration migration. It contains no user records, OAuth secrets or tokens.

It is a reference and an executable fixture source for `tests/fullIntegration.test.ts`, not a migration to apply to production. The committed historical migrations remain authoritative for versions already recorded remotely. New migrations are additive and tested against this snapshot with mocked Auth roles/functions in isolated PostgreSQL.
