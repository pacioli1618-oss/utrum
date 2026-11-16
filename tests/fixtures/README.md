Real responses from the `ut_*` RPCs, used by `tests/api-mappers.test.ts` to check the mapping
from snake_case jsonb to the view types. They hold no tokens. Refresh them after any migration
that changes what an RPC returns (they were captured by running the migration on a local
Postgres and calling the RPCs).
