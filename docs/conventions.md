# Naming conventions

English is the base language of the codebase. Everything a developer reads or types is in English: identifiers, files, folders, routes, database objects, error codes, commits, code comments and developer docs. Only **user-facing text** is translated, and it lives in `messages/<locale>.json`, never in code.

## 1. Domain glossary

One concept, one word, everywhere: database, TypeScript, i18n keys and docs. When a pt-BR UI word has no listed term, add it here before using it.

| pt-BR (UI) | Code term | Examples |
| --- | --- | --- |
| Priorização (a lista) | `list` | `utrum.lists`, `ListView`, `getList()` |
| Item | `item` | `utrum.items`, `item_low_id`, `ut_add_items` |
| Critério de escolha (a pergunta) | `criterion` | `lists.criterion`, `CriterionField` |
| Explicação do critério | `criterion detail` | `criterion_detail`, `criterionDetail` |
| Método rápido / completo | `method` (`quick` / `full`) | `lists.method`, `Method` |
| Organizador | `host` | `host_tokens`, `hostToken`, `ut_get_list_as_host` |
| Link de organizador | `host token` | `p_host_token`, `/l/[slug]/manage#<hostToken>` |
| Participante | `participant` | `participants`, `participantId` |
| Link pessoal | `participant token` | `p_participant_token`, `/l/[slug]/me#<participantToken>` |
| Entrar pelo link | `join` | `ut_join_list` |
| Escolha entre dois itens | `comparison` | `utrum.comparisons`, `ut_add_comparison`, `winner_id` |
| Ranking (de uma pessoa) | `ranking` | `participants.ranking`, `evaluateRanking()` |
| Concluir o ranking | `complete` | `completed_at`, `hasCompleted` |
| Sugerir item | `suggest` | `ut_suggest_item`, `addedByName` |
| Comparar visões / resultados | `results` | `results_json`, `ResultsView` |
| Ranking consolidado | `summary` | `summarizeResults()` |
| Concordância | `agreement` | `agreementBetween()` |
| Diferença de posição | `spread` | `ResultRow.spread` |
| Minhas priorizações | `my lists` | `/my-lists`, `useMyLists()` |
| Aparelho | `device` | `deviceId`, `device-store.ts` |

## 2. Abbreviations

Write words out in full: `quantity`, not `qty`; `event`, not `evt`; `participant`, not `part`.

These are the only allowed abbreviations: `id`, `url`, `api`, `db`, `rsvp`, `i18n`, `ui`, `pwa`, `og` (Open Graph), plus the SQL prefixes in section 4.

## 3. TypeScript and React

| Thing | Style | Example |
| --- | --- | --- |
| React component file | `PascalCase.tsx` | `LocaleSwitcher.tsx`, `ResultsView.tsx` |
| Any other module | `kebab-case.ts` | `device-store.ts`, `use-loader.ts` |
| Component, type, interface | `PascalCase`, no `I` prefix | `ListSummary`, `ListView`, `StoredList` |
| Function, variable | `camelCase`, verb first for functions | `createList()`, `parseItems()` |
| Hook | `useCamelCase`, file `use-kebab.ts` | `useLoader()` in `use-loader.ts` |
| Boolean | `is`, `has`, `can` or `should` prefix | `isHost`, `hasCompleted` |
| Event handler | `handleX` inside, `onX` as a prop | `onRemove={handleRemove}` |
| Module-level constant | `SCREAMING_SNAKE_CASE` for fixed scalars | `STORAGE_KEY`, `DEBOUNCE_MS` |
| Readonly list of codes | `camelCase` plural, with a singular type | `unitCodes` / `UnitCode` |
| Next.js special files | the framework's names | `page.tsx`, `layout.tsx`, `proxy.ts` |
| Test file | `tests/<module>.test.ts`; fixtures in `tests/fixtures/`, named after the RPC | `tests/api-mappers.test.ts`, `ut_get_list_as_host.json` |

**Database ↔ TypeScript boundary:** the database speaks `snake_case` and TypeScript speaks `camelCase`. The conversion happens only in `src/lib/api.ts` and `src/lib/api-mappers.ts`. Components never see `p_` parameters or snake_case fields.

## 4. Database (Postgres / Supabase)

| Thing | Style | Example |
| --- | --- | --- |
| Schema | app name | `utrum` |
| Table | `snake_case`, plural noun | `lists`, `host_tokens`, `comparisons` |
| Column | `snake_case`, singular | `criterion_detail`, `winner_id` |
| Primary key | `id uuid` | |
| Foreign key | `<singular table>_id` | `list_id`, `participant_id` |
| Timestamp | `<verb>_at` (`timestamptz`) | `created_at`, `revoked_at`, `completed_at` |
| Boolean | `is_` / `has_`, or a past participle | `is_bulk` (parameter) |
| Code-valued text | `text` + `check (... in (...))`, English codes | `method in ('quick', 'full')` |
| Public RPC | `ut_<verb>_<noun>` in `public` | `ut_create_list`, `ut_add_comparison`, `ut_get_list_as_host` |
| Internal helper | `<verb>_<noun>` in `utrum` | `require_list`, `require_host_list`, `valid_ranking` |
| Function parameter | `p_` + `snake_case` | `p_slug`, `p_host_token` |
| PL/pgSQL local variable | `v_` + `snake_case` | `v_slug`, `v_ranking` |
| Index | `<table>_<columns>_idx` | `participants_list_id_idx` |
| Migration file | `<YYYYMMDDHHMMSS>_<snake_case_summary>.sql` | `20261116000100_utrum_schema.sql` |

Columns repeat the table name only when the bare word is a SQL type or keyword.

**RPC verbs:** use `get`, `create`, `update`, `add`, `delete` (a row), `remove` (a person from a list), `join`, `open`, `undo`, `reset`, `suggest`.

## 5. Error codes

Errors raised by RPCs carry a fixed English code as the message, in `snake_case`: `<subject>_<problem>` (`list_not_found`, `item_label_taken`) or a generic state (`not_authorized`, `not_enough_items`). Extra data goes in `DETAIL` (`participant_name_taken` → the name; `item_label_taken` → the label; `rate_limited` → `hour` or `day`). The `Errors` namespace in `messages/*.json` uses the **same codes as keys**. This is the one place where i18n keys are `snake_case`.

## 6. Realtime

Not used yet. If added, the channel topic is `<entity>:<key>` (`list:<slug>`) and broadcast event names are past-tense verbs (`changed`).

## 7. Routes and URLs

Paths are short, lowercase, kebab-case English. They never include the locale (see `docs/i18n.md`). Secrets go in the URL fragment (`#…`) so they never reach the server or its logs.

| Route | Screen |
| --- | --- |
| `/` | Create a list |
| `/l/[slug]` | Join with your name (no personal link on this device yet), then your personal page: compare, my ranking, compare views |
| `/l/[slug]/host` | Host panel: share, participants, results, items, host link |
| `/l/[slug]/manage#<hostToken>` | Host link: stores the token on the device, then opens the host panel |
| `/l/[slug]/me#<participantToken>` | Personal link: stores the token on the device, then opens `/l/[slug]` |
| `/my-lists` | My lists |
| `/about`, `/privacy`, `/terms` | About, privacy policy, terms. Operator and contact in `src/lib/site.ts`. |
| `/api/og/[slug]`, `/api/og?locale=` | Link-preview image (list card, or the app's card). Under `/api` so the locale proxy skips it. |

Link previews: `app/[locale]/l/[slug]/layout.tsx` sets the og/twitter tags for every page of a list,
in the **list's** language (`lists.locale`), since crawlers send no cookie. They never show names or rankings. List pages are `noindex`.

## 8. i18n messages

- **Namespaces** are `PascalCase`, one per screen or shared area: `CreateList`, `Host`, `Personal`, `Results`, `Common`.
- **Keys** are `camelCase`, named for meaning, not wording: `resultsLocked`, not `resultadosBloqueados`.
- **Code-valued keys** match the stored code exactly: `Errors.list_not_found`.
- `pt-BR` is the source file; `npm run i18n:check` enforces the rest.

## 9. CSS and design tokens

- **Tokens:** custom properties use the Design System token names, in `kebab-case` English: `--surface`, `--brand-strong`, `--ember`, `--radius-md`. They are all declared in `src/app/globals.css`, kept in sync with the Design System.
- **Styling:** CSS Modules, one `Component.module.css` next to `Component.tsx`. Class names are `camelCase` (`styles.fullWidth`).
- **Colors and sizes** come only from tokens (`var(--…)`). No hex values or magic radii inside components.
- **Borders, not shadows.**

## 10. Folders

| Folder | What goes there |
| --- | --- |
| `src/app/[locale]/` | Routes (pages, layouts). Page-only components sit next to their `page.tsx`. |
| `src/components/brand/` | Logo and other brand marks |
| `src/components/ui/` | Design System primitives with no domain knowledge: `Button`, `TextField`, `TextAreaField`, `Tag`, `Card`, `CopyButton` |
| `src/components/list/` | Components that know the domain: `ListSummary`, `CriterionField`, `RankingList`, `ResultsView`, `LinkBox`, `StatusScreen` |
| `src/hooks/` | React hooks shared across screens: `use-loader.ts`, `use-stored-list.ts`, `use-origin.ts` |
| `src/lib/` | Framework-free logic and the database door: `api.ts`, `api-mappers.ts`, `ranking.ts`, `share-links.ts`, `clipboard.ts`, `device-store.ts` |
| `src/i18n/` | Locales, routing, formatting helpers |

## 11. Environment variables

`SCREAMING_SNAKE_CASE`. The `NEXT_PUBLIC_` prefix only for values that are safe in the browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Server secrets have no prefix: `SUPABASE_SECRET_KEY`.

## 12. Git

- **Branches:** `<type>/<kebab-summary>`, as in `feat/suggest-item` or `fix/undo-after-new-item`.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) in English, imperative mood, as in `feat(results): hide rankings until your own is complete`. Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `db` (migrations), `i18n`.

## 13. Comments and docs

- **Code comments** are in English and explain *why*, not *what*.
- **Developer docs** (`README.md`, `docs/`) are in English.
- **Product and business documents** for the team, outside the repository, may stay in pt-BR.
