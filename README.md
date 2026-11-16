# Utrum

*Utrum* is Latin for "which of the two?". A sign-up-free web app to **prioritize anything by
comparing two items at a time**: topics, movies, problems, tasks. Each person builds their own
ranking from simple choices, then compares their view with everyone else's. The criterion (the
question asked on every comparison) is chosen by whoever creates the list. Licensed under
AGPL-3.0. A GR1618 app, built on the same base as [QuemLeva](https://github.com/pacioli1618-oss/quemLeva)
and [AmigoSecreto](https://github.com/pacioli1618-oss/amigosecreto).

- Next.js 16 (App Router, `cacheComponents`) + Supabase (Postgres, `ut_*` RPCs)
- Languages: pt-BR, es, en. See [docs/i18n.md](docs/i18n.md).
- Naming and code style: [docs/conventions.md](docs/conventions.md). **Read it before contributing.**
- Deliberately left for later: [docs/improvements.md](docs/improvements.md).
- Everything the app stores on the device goes through `src/lib/device-store.ts`.
- The ranking engine is `src/lib/ranking.ts`: framework-free, deterministic, unit-tested.

## How it works

| Who | Link | What they do |
| --- | --- | --- |
| Host | `/` → `/l/<slug>/host` (backup: `/l/<slug>/manage#<hostToken>`) | Writes the list, the criterion and the method; shares the link; sees everyone's progress and ranking; adds and removes items; removes people. |
| Anyone with the list link | `/l/<slug>` | Joins with their own name. Their personal link stays only on their phone. |
| Each participant | `/l/<slug>` (another device: `/l/<slug>/me#<participantToken>`) | Compares two items at a time, sees their ranking, suggests items. Sees the others' rankings **only after completing their own**, so nobody is anchored by the group. |

**Methods** (`lists.method`):

- `quick` — binary insertion sort: about n·log₂n answers (6 items ≈ 10, 20 items ≈ 65).
- `full` — every pair once, n·(n−1)/2 answers, ranked by wins (ties broken head to head). Best for short lists.

A person's state is just their answers. The next pair, the progress and the ranking are recomputed
from them in the browser, so undoing, reloading, adding or removing items all just work: a new item
asks only the comparisons it needs; a removed item leaves the rest of every ranking in order. Each
person gets the questions in their own order (seeded by their id). When an answer completes the
ranking, the browser sends it along; the server keeps it only if it lists every item exactly once.

**Comparing views**: consolidated ranking (mean position), the spread of each item across people,
and the agreement of every pair of people (share of item pairs they ordered the same way).

## Running

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types and runs TypeScript |
| `npm run i18n:check` | Checks translations: keys, ICU syntax and arguments |
| `npm test` | Unit tests (Node test runner + tsx): ranking engine, links, RPC response mapping against real fixtures |
| `npm run db:types` | Regenerates `src/lib/database.types.ts` from the database (run `npx supabase login` once) |

## Database

Lives in the QuemLeva Supabase project, in its own `utrum` schema, which is not exposed through
the Data API: all access goes through the `public.ut_*` functions. Migrations live in
`supabase/migrations/`. After applying one, run `npm run db:types` and, if an RPC response
changed, refresh `tests/fixtures/` and the types in `src/lib/api-mappers.ts`.
