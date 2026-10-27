# Development guide

## Boundaries

- `src/App.tsx` owns routing and lazy route imports. Keep URLs and compatibility redirects stable.
- `src/pages/` composes screens. Put exercise transitions, autosave and business rules in feature controllers or services, rather than growing another page-sized component.
- `src/features/sets/` contains the draft controller, card editor, import dialog, deck preview/dialogs and deck-specific query. `useSetDraft` owns the serialized write queue, navigation flush and publishing boundary.
- `src/features/quizzes/` separates the session controller, configuration, individual questions, matching state, pure answer evaluation/adaptive scheduling and transactional result persistence. Result rendering does not write to the database.
- `src/components/` contains shared UI contracts, including native dialogs, auto-growing textareas and explicit answer alternatives. A domain-specific component belongs in its feature.
- `src/services/` owns data-changing commands. Sets, collection membership, vocabulary imports, drafts, solutions, review scheduling and backups have explicit entry points. `wordModel` and subject validation are independent of React and database state.
- `src/hooks/useData.ts` requires the exact tables a screen consumes. Do not restore a global subscription to every table. `useSetData` reads a deck's word IDs with `bulkGet`; the set page does not load the whole vocabulary.
- `src/store/` separates persisted settings, defaults/legacy migration and transient UI state. Guest settings are browser-local; account settings are isolated by user and mirrored to cloud preferences. Auth identity lives in `src/cloud/auth.ts`.
- `src/styles/main.css` defines the cascade order. CSS is native and divided into foundation, controls, feature surfaces and responsive layout. Add styles in the responsible file; check both themes and narrow screens.

## Data invariants

1. Card identity includes learning language, definition language, normalized term and translation. A deck copy reuses card IDs and review history.
2. A module contains decks of one language and may belong to a folder. Folder study includes child modules without duplicate card IDs.
3. Publishing validates every card and commits words, deck, statistics and draft deletion together. A failure leaves the draft available.
4. A completed test commits its assessments and saved result together. Matching assessments distinguish individual involved words.
5. Removing deck membership or a deck retains vocabulary; removing a word removes memberships and review history. Removing a folder detaches child modules.
6. Backups validate before replacing data. Keep existing IDs, table/schema compatibility and prepared-library migration markers. Deprecated settings are ignored without discarding current profile/rule settings.
7. Folders and modules belong to one learning language. Persist it even for empty folders; validate deck and parent-folder language at save boundaries. Legacy collections are scoped by their contents through `collectionsForLanguage`; viewing another language must not mutate stored memberships.
8. Written answers are submitted by Enter/Done; test drafts remain editable until the final check. Do not reintroduce submit-on-blur.

## Verification

Use the pinned pnpm version in `package.json` and the committed lockfile. `npm run check` runs strict TypeScript, a dependency/export reachability check, all unit tests and the PWA build. The reachability check starts at `src/main.tsx`, follows static imports/re-exports and literal dynamic imports; test references count when checking supported exports.

`npm run test:e2e:production` starts or reuses preview on port 4173 and includes the offline reload/write scenario. Chrome is required. Set `E2E_BASE_URL` only when supplying your own running server. CI installs Chrome, runs the same checks and uploads failed traces. Action configuration follows the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node) and [upload-artifact](https://github.com/actions/upload-artifact) documentation. CI is defined in `.github/workflows/ci.yml`; local success does not imply a remote CI run has occurred.

Use meaningful behavior checks: rollback, card reuse, migration, answer rules, adaptive queue order, mobile input, menu dismissal and real production caching. Do not remove a user workflow merely because an old test expects removed UI; update the scenario to the current product flow.

`node scripts/screenshots.mjs` produces isolated examples in `artifacts/preview/`. `scripts/youtube-live-check.mjs` is a separate manual check against the real external player; regular video tests use a deterministic fixture.

## Future cloud integration

Supabase/Auth lives in `src/cloud/`, with SQL and RLS in `supabase/`. `src/db/syncMiddleware.ts` captures application writes and the outbox in the same native IndexedDB transaction, including nested service transactions. Account bootstrap and incoming cloud changes use `localOnly`; they must never enqueue themselves. Ownership, account isolation, idempotent event delivery, tombstones and conflicts are integration contracts. Do not turn `useData` into direct network calls or upload the entire browser database on each answer. Preserve the command boundaries and distinguish shared catalog content from personal learning progress.

Cloud rules and the write map: [docs/CLOUD_DATA_RULES.md](docs/CLOUD_DATA_RULES.md). Setup and checks: [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md).
