import { clearDraftJournals } from "./draftRecovery";
import { dataTables } from "../cloud/types";
import { wordIdentity } from "./wordModel";
import { db } from "../db/database";
import type {
  DailyStatistics,
  Deck,
  RecentItem,
  TextDocument,
  Video,
  Word,
} from "../types";
import { dateKey, uid } from "../utils/format";
export const emptyDay = (date = dateKey()): DailyStatistics => ({
  date,
  wordsAdded: 0,
  wordsReviewed: 0,
  correctAnswers: 0,
  incorrectAnswers: 0,
  studyMinutes: 0,
  readingMinutes: 0,
  listeningMinutes: 0,
});
export async function trackActivity(
  patch: Partial<Omit<DailyStatistics, "date">>,
) {
  await db.transaction(
    "rw",
    [db.statistics, ...(db.owner ? [db.activity] : [])],
    async () => {
      if (db.owner)
        await db.activity.add({
          id: uid(),
          date: dateKey(),
          patch,
          timestamp: Date.now(),
        });
      const day = (await db.statistics.get(dateKey())) ?? emptyDay();
      for (const key of Object.keys(patch) as (keyof typeof patch)[])
        day[key] += patch[key] ?? 0;
      await db.statistics.put(day);
    },
  );
}
export async function matchingWord(
  word: Pick<Word, "language" | "nativeLanguage" | "term" | "translation">,
  exceptId?: string,
) {
  const identity = wordIdentity(word);
  return db.words
    .where("[language+nativeLanguage]")
    .equals([word.language, word.nativeLanguage])
    .filter(
      (candidate) =>
        candidate.id !== exceptId && wordIdentity(candidate) === identity,
    )
    .first();
}
export const WordRepository = {
  async save(word: Word, deckId?: string) {
    if (!word.term.trim() || !word.translation.trim())
      throw new Error("Введите слово и перевод");
    return db.transaction(
      "rw",
      [db.words, db.decks, db.statistics, ...(db.owner ? [db.activity] : [])],
      async () => {
        const exists = await db.words.get(word.id);
        const duplicate = await matchingWord(word, word.id);
        if (exists && duplicate && wordIdentity(exists) !== wordIdentity(word))
          throw new Error(
            "Такая карточка уже есть в словаре. Используйте существующую карточку.",
          );
        if (exists && exists.language !== word.language) {
          const linked = await db.decks
            .where("wordIds")
            .equals(word.id)
            .count();
          if (linked)
            throw new Error(
              "Язык общей карточки нельзя менять, пока она используется в колодах.",
            );
        }
        const reuse = !exists ? duplicate : undefined;
        const saved = reuse ?? {
          ...word,
          ...(exists && exists.status !== word.status
            ? {
                manualProgress: {
                  at: Date.now(),
                  status: word.status,
                  nextReviewAt: word.nextReviewAt,
                },
              }
            : {}),
          term: word.term.trim(),
          translation: word.translation.trim(),
          updatedAt: Date.now(),
        };
        if (!reuse) await db.words.put(saved);
        if (!exists && !duplicate) await trackActivity({ wordsAdded: 1 });
        let targetDeck = deckId;
        if (!targetDeck && !exists && word.sourceId && word.sourceTitle) {
          targetDeck = `source-${word.language}-${word.sourceId}`;
          if (!(await db.decks.get(targetDeck)))
            await db.decks.add({
              id: targetDeck,
              title: word.sourceTitle,
              description: "Слова, сохранённые из этого источника.",
              language: word.language,
              tags: [word.sourceType === "video" ? "видео" : "чтение"],
              wordIds: [],
              createdAt: Date.now(),
              updatedAt: Date.now(),
              favorite: false,
            });
        }
        if (targetDeck) {
          const deck = await db.decks.get(targetDeck);
          if (!deck || deck.language !== saved.language)
            throw new Error("Выберите колоду на языке слова");
          if (!deck.wordIds.includes(saved.id))
            await db.decks.update(targetDeck, {
              wordIds: [...deck.wordIds, saved.id],
              updatedAt: Date.now(),
            });
        }
        return saved.id;
      },
    );
  },
  async delete(ids: string[]) {
    await db.transaction(
      "rw",
      db.words,
      db.decks,
      db.reviews,
      db.recent,
      async () => {
        await db.words.bulkDelete(ids);
        await db.reviews.where("wordId").anyOf(ids).delete();
        await db.recent.bulkDelete(ids.map((id) => `vocabulary/${id}`));
        const removed = new Set(ids);
        const decks = await db.decks
          .where("wordIds")
          .anyOf(ids)
          .distinct()
          .toArray();
        await db.decks.bulkPut(
          decks.map((deck) => ({
            ...deck,
            wordIds: deck.wordIds.filter((id) => !removed.has(id)),
          })),
        );
      },
    );
  },
  async patch(id: string, patch: Partial<Word>) {
    await db.transaction("rw", db.words, async () => {
      const current = await db.words.get(id);
      if (!current) throw new Error("Слово больше не существует");
      const manualProgress =
        patch.status !== undefined || patch.nextReviewAt !== undefined
          ? {
              at: Date.now(),
              status: patch.status ?? current.status,
              nextReviewAt: patch.nextReviewAt ?? current.nextReviewAt,
            }
          : current.manualProgress;
      await db.words.update(id, {
        ...patch,
        manualProgress,
        updatedAt: Date.now(),
      });
    });
  },
  async move(ids: string[], deckId: string) {
    await db.transaction("rw", db.decks, db.words, async () => {
      const target = await db.decks.get(deckId);
      const words = await db.words.bulkGet(ids);
      if (!target || words.some((w) => !w || w.language !== target.language))
        throw new Error("Слова и колода должны быть на одном языке");
      await db.decks.update(deckId, {
        wordIds: [...new Set([...target.wordIds, ...ids])],
        updatedAt: Date.now(),
      });
    });
  },
};
export const DeckRepository = {
  save: (deck: Deck) => db.decks.put(deck),
  delete: (id: string) =>
    db.transaction(
      "rw",
      [db.decks, db.recent, db.collections, db.drafts],
      async () => {
        await db.collections
          .where("deckIds")
          .equals(id)
          .modify((collection) => {
            collection.deckIds = collection.deckIds.filter(
              (deckId) => deckId !== id,
            );
          });
        await db.drafts.where("sourceDeckId").equals(id).delete();
        await db.decks.delete(id);
        await db.recent.delete(`decks/${id}`);
      },
    ),
  duplicate: async (deck: Deck) => {
    const id = uid();
    await db.decks.add({
      ...deck,
      id,
      title: `${deck.title} — копия`,
      wordIds: [...deck.wordIds],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastStudiedAt: undefined,
    });
    return id;
  },
};
export const TextRepository = {
  save: (text: TextDocument) => db.texts.put(text),
  delete: (id: string) =>
    db.transaction("rw", db.texts, db.recent, async () => {
      await db.texts.delete(id);
      await db.recent.delete(`reader/${id}`);
    }),
  progress: (id: string, readingProgress: number) =>
    db.texts
      .where("id")
      .equals(id)
      .modify((text) => {
        text.readingProgress = Math.max(
          text.readingProgress,
          Math.min(100, readingProgress),
        );
      }),
};
export const VideoRepository = {
  save: (video: Video) => db.videos.put(video),
  delete: (id: string) =>
    db.transaction("rw", db.videos, db.recent, async () => {
      await db.videos.delete(id);
      await db.recent.delete(`videos/${id}`);
    }),
  position: (id: string, lastPosition: number) =>
    db.videos.update(id, { lastPosition }),
};
export async function remember(
  kind: RecentItem["kind"],
  id: string,
  title: string,
) {
  await db.recent.put({
    key: `${kind}/${id}`,
    kind,
    id,
    title,
    timestamp: Date.now(),
  });
}
export async function clearData() {
  const owner = db.owner;
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables.filter((table) =>
      (dataTables as readonly string[]).includes(table.name),
    ))
      await table.clear();
    if (db.owner)
      await db.syncMeta.put({ key: "statisticsBaseline", value: [] });
    if (db.owner)
      await db.preferences.put({ id: "statisticsBaseline", value: [] });
  });
  clearDraftJournals(owner);
}
