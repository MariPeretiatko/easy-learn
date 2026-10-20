import { db } from "../db/database";
import type {
  DailyStatistics,
  Deck,
  RecentItem,
  TextDocument,
  Video,
  Word,
} from "../types";
import { dateKey, normalize, uid } from "../utils/format";
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
  await db.transaction("rw", db.statistics, async () => {
    const day = (await db.statistics.get(dateKey())) ?? emptyDay();
    for (const key of Object.keys(patch) as (keyof typeof patch)[])
      day[key] += patch[key] ?? 0;
    await db.statistics.put(day);
  });
}
export const newWord = (draft: Partial<Word>): Word => ({
  id: uid(),
  term: "",
  translation: "",
  language: "de",
  nativeLanguage: "ru",
  definition: "",
  example: "",
  pronunciation: "",
  ipa: "",
  partOfSpeech: "",
  gender: "",
  article: "",
  plural: "",
  verbForms: "",
  synonyms: "",
  antonyms: "",
  notes: "",
  tags: [],
  status: "new",
  difficulty: 2,
  interval: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  nextReviewAt: Date.now(),
  reviewCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  favorite: false,
  type: "word",
  separable: false,
  reflexive: false,
  preposition: "",
  grammaticalCase: "",
  ...draft,
});
export const WordRepository = {
  async save(word: Word, deckId?: string) {
    if (!word.term.trim() || !word.translation.trim())
      throw new Error("Введите слово и перевод");
    await db.transaction("rw", db.words, db.decks, db.statistics, async () => {
      const duplicate = await db.words
        .where("language")
        .equals(word.language)
        .filter(
          (w) => normalize(w.term) === normalize(word.term) && w.id !== word.id,
        )
        .first();
      if (duplicate) throw new Error("Это слово уже есть в словаре");
      const exists = await db.words.get(word.id);
      if (exists && exists.language !== word.language) {
        await db.decks
          .where("language")
          .notEqual(word.language)
          .modify((d) => {
            d.wordIds = d.wordIds.filter((id) => id !== word.id);
          });
      }
      await db.words.put({
        ...word,
        term: word.term.trim(),
        translation: word.translation.trim(),
        updatedAt: Date.now(),
      });
      if (!exists) await trackActivity({ wordsAdded: 1 });
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
        if (!deck || deck.language !== word.language)
          throw new Error("Выберите колоду на языке слова");
        if (!deck.wordIds.includes(word.id))
          await db.decks.update(targetDeck, {
            wordIds: [...deck.wordIds, word.id],
            updatedAt: Date.now(),
          });
      }
    });
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
        await db.recent
          .filter((r) => r.kind === "vocabulary" && ids.includes(r.id))
          .delete();
        await db.decks.toCollection().modify((d) => {
          d.wordIds = d.wordIds.filter((id) => !ids.includes(id));
        });
      },
    );
  },
  async patch(id: string, patch: Partial<Word>) {
    await db.words.update(id, { ...patch, updatedAt: Date.now() });
  },
  async move(ids: string[], deckId: string) {
    await db.transaction("rw", db.decks, db.words, async () => {
      const target = await db.decks.get(deckId);
      const words = await db.words.bulkGet(ids);
      if (!target || words.some((w) => !w || w.language !== target.language))
        throw new Error("Слова и колода должны быть на одном языке");
      await db.decks.toCollection().modify((d) => {
        d.wordIds = d.wordIds.filter((id) => !ids.includes(id));
        if (d.id === deckId) d.wordIds.push(...ids);
        d.updatedAt = Date.now();
      });
    });
  },
};
export const DeckRepository = {
  save: (deck: Deck) => db.decks.put(deck),
  delete: (id: string) =>
    db.transaction("rw", db.decks, db.recent, async () => {
      await db.decks.delete(id);
      await db.recent.delete(`decks/${id}`);
    }),
  duplicate: async (deck: Deck) =>
    db.decks.add({
      ...deck,
      id: uid(),
      title: `${deck.title} — копия`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
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
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
  });
}
