# Development checkpoints

## Implemented scope

| Phase               | Result                                                                                             |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| 1. Foundation       | React, strict TypeScript, routing, settings, IndexedDB repositories, reusable UI and themes.       |
| 2. Vocabulary       | CRUD, details, filters, bulk actions, duplicates, favorites and pronunciation.                     |
| 3. Decks            | CRUD, duplication, membership, source decks, export and progress.                                  |
| 4. Flashcards       | Flip, audio, shuffle, keyboard controls, fullscreen and session results.                           |
| 5. SRS              | Persistent due dates, rating intervals, review history and daily statistics.                       |
| 6. Learn & Test     | Multiple question formats, retries, configurable tests and matching game.                          |
| 7. Reader           | Interactive tokens and phrases, saved word states, reading progress and local translation adapter. |
| 8. YouTube          | Library, real IFrame API, speed, seeking, persisted position and imported subtitles.               |
| 9. Listening        | Sentence loops, A–B repeat, auto pause, transcript modes and aligned dictation feedback.           |
| 10. Statistics      | Charts, goals, streaks, achievements, search and recent materials.                                 |
| 11. Import / Export | CSV preview and deduplication; versioned, validated transactional JSON backup restore.             |
| 12. PWA             | Install manifest, production asset cache, offline local learning and update prompt.                |

The Quizlet-inspired redesign applies to the header, navigation, mode tiles, forms, tables, practice screens, reader, video library, statistics, dialogs, mobile layouts and dark theme. It uses original HTML/CSS illustrations and keeps the Easy Learn identity.

## Verification

Verified on 2026-10-19 using installed Google Chrome and Playwright:

- Strict TypeScript check and production build pass.
- 17 unit tests pass: review scheduling, CSV, repositories, subtitles, dictation and metrics.
- 6 production browser tests pass: vocabulary/decks/practice, reader/source decks, backup round trip, responsive layouts/search/dark theme, video/listening, and actual offline reload with writes.
- The responsive test also checks mobile search focus and submission.
- A separate live YouTube check confirmed the actual IFrame API reaches ready state and enables player controls. Automated video tests use a deterministic player fixture to validate application behavior.
- Screenshots in `artifacts/` are generated from an isolated demonstration library; tests do not modify the user's browser data.

`scripts/smoke.mjs` provides route smoke checks. `scripts/screenshots.mjs` regenerates desktop and mobile screenshots against the production preview at port 4173. Detailed tests are in `tests/` and alongside services.

Translation remains a small local dictionary with manual fallback. Subtitles are imported manually, and notifications require an open app. These limitations and future service integration points are documented in README.md.
