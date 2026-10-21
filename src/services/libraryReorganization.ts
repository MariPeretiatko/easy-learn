import { db } from "../db/database";
import { wordIdentity } from "./wordModel";
import type { LibraryBundle } from "./libraryImport";
import type { Deck } from "../types";

// Move existing word IDs instead of recreating words: SRS, notes and history stay intact.
export async function reorganizeGermanLibrary(bundle: LibraryBundle) {
  await db.transaction(
    "rw",
    [db.words, db.decks, db.collections, db.recent, db.drafts, db.testResults],
    async () => {
      const sourceDeckIds = new Set(
        bundle.folders.flatMap((folder) =>
          folder.modules.flatMap((module) =>
            module.decks.flatMap((deck) =>
              deck.cards.flatMap((card) =>
                card.sourceDeckId ? [card.sourceDeckId] : [],
              ),
            ),
          ),
        ),
      );
      const sourceGroupIds = new Set(bundle.legacyCollectionIds ?? []);
      const words = new Map(
        (await db.words.toArray()).map((word) => [word.id, word]),
      );
      const decks = new Map(
        (await db.decks.toArray()).map((deck) => [deck.id, deck]),
      );
      if (![...sourceDeckIds].some((id) => decks.has(id))) return;
      const targetDecks = new Map<string, Deck>();
      const replacements = new Map<string, Set<string>>();
      const assigned = new Map<string, Set<string>>();
      const now = Date.now();
      let order = 0;
      for (const folder of bundle.folders) {
        for (const module of folder.modules) {
          const moduleDeckIds: string[] = [];
          for (const target of module.decks) {
            const ids = new Set<string>();
            for (const card of target.cards) {
              const sourceId = card.sourceDeckId;
              if (!sourceId) throw new Error("Не указан источник карточки");
              const source = decks.get(sourceId);
              // Previously deleted cards/decks must stay deleted.
              if (!source) continue;
              if (!replacements.has(sourceId))
                replacements.set(sourceId, new Set());
              replacements.get(sourceId)!.add(target.id);
              if (!assigned.has(sourceId)) assigned.set(sourceId, new Set());
              const sourceWords = source.wordIds.flatMap((id) =>
                words.get(id) ? [words.get(id)!] : [],
              );
              const identity = wordIdentity({
                ...card,
                language: bundle.language,
                nativeLanguage: bundle.nativeLanguage,
              });
              const exact = sourceWords.find(
                (word) => wordIdentity(word) === identity,
              );
              const byTerm = sourceWords.filter(
                (word) =>
                  word.term.normalize("NFC").trim().toLowerCase() ===
                  card.term.normalize("NFC").trim().toLowerCase(),
              );
              const matched =
                exact ?? (byTerm.length === 1 ? byTerm[0] : undefined);
              if (matched) {
                ids.add(matched.id);
                assigned.get(sourceId)!.add(matched.id);
              }
            }
            const existing = decks.get(target.id);
            const value: Deck = existing ?? {
              id: target.id,
              title: target.title,
              description: "",
              language: bundle.language,
              tags: [folder.title, module.title],
              wordIds: [...ids],
              createdAt: now - order,
              updatedAt: now - order,
              favorite: false,
            };
            order++;
            targetDecks.set(value.id, value);
            moduleDeckIds.push(value.id);
          }
          await db.collections.put({
            id: module.id,
            title: module.title,
            kind: "course",
            folderId: folder.id,
            language: bundle.language,
            description: "",
            deckIds: moduleDeckIds,
            createdAt: now - order,
            updatedAt: now - order,
          });
        }
        await db.collections.put({
          id: folder.id,
          title: folder.title,
          kind: "folder",
          description: "",
          deckIds: [],
          createdAt: now,
          updatedAt: now,
        });
      }
      // Keep user-added or fully renamed cards in the nearest replacement deck.
      for (const sourceId of sourceDeckIds) {
        const source = decks.get(sourceId);
        const targetId = [...(replacements.get(sourceId) ?? [])][0];
        if (!source || !targetId) continue;
        const target = targetDecks.get(targetId)!;
        target.wordIds = [
          ...new Set([
            ...target.wordIds,
            ...source.wordIds.filter(
              (id) => words.has(id) && !assigned.get(sourceId)?.has(id),
            ),
          ]),
        ];
        if (source.description.trim())
          target.description = [
            target.description,
            `${source.title}: ${source.description}`,
          ]
            .filter(Boolean)
            .join("\n\n");
        target.tags = [...new Set([...target.tags, ...source.tags])];
        if (source.favorite) target.favorite = true;
        if (source.lastStudiedAt)
          target.lastStudiedAt = Math.max(
            target.lastStudiedAt ?? 0,
            source.lastStudiedAt,
          );
      }
      // Remove empty replacements when the user had deleted their original contents.
      const activeTargets = new Set(
        [...targetDecks.values()]
          .filter((deck) => deck.wordIds.length)
          .map((deck) => deck.id),
      );
      await db.decks.bulkPut(
        [...targetDecks.values()].filter((deck) => activeTargets.has(deck.id)),
      );
      const replace = (ids: string[]) => [
        ...new Set(
          ids.flatMap((id) =>
            sourceDeckIds.has(id)
              ? [...(replacements.get(id) ?? [])].filter((target) =>
                  activeTargets.has(target),
                )
              : [id],
          ),
        ),
      ];
      for (const collection of await db.collections.toArray()) {
        if (sourceGroupIds.has(collection.id)) {
          const personalDecks = collection.deckIds.filter(
            (id) => !sourceDeckIds.has(id),
          );
          if (personalDecks.length)
            await db.collections.put({
              ...collection,
              folderId: undefined,
              deckIds: personalDecks,
            });
          else await db.collections.delete(collection.id);
        } else {
          await db.collections.put({
            ...collection,
            deckIds: replace(collection.deckIds).filter(
              (id) => !targetDecks.has(id) || activeTargets.has(id),
            ),
          });
        }
      }
      for (const draft of await db.drafts.toArray()) {
        if (draft.sourceDeckId && sourceDeckIds.has(draft.sourceDeckId))
          await db.drafts.put({ ...draft, sourceDeckId: undefined });
      }
      for (const recent of await db.recent.toArray()) {
        if (recent.kind === "modules" && sourceGroupIds.has(recent.id))
          await db.recent.delete(recent.key);
        if (recent.kind === "decks" && sourceDeckIds.has(recent.id)) {
          const targetId = replace([recent.id])[0];
          await db.recent.delete(recent.key);
          const target = targetId ? targetDecks.get(targetId) : undefined;
          if (target) {
            const key = `decks/${target.id}`;
            const previous = await db.recent.get(key);
            if (!previous || previous.timestamp < recent.timestamp)
              await db.recent.put({
                ...recent,
                key,
                id: target.id,
                title: target.title,
              });
          }
        }
      }
      for (const result of await db.testResults.toArray()) {
        if (result.deckId && sourceDeckIds.has(result.deckId))
          await db.testResults.put({
            ...result,
            deckId: replace([result.deckId])[0],
          });
      }
      await db.decks.bulkDelete([...sourceDeckIds]);
    },
  );
}
