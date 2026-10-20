import { db } from "../db/database";
import type {
  Word,
  Deck,
  TextDocument,
  Video,
  ReviewHistory,
  DailyStatistics,
  RecentItem,
  Settings,
} from "../types";
import { defaultSettings, useSettings } from "../store/useSettings";
import { newWord } from "./repositories";
import { isSubtitle } from "../features/youtube/subtitles";
export interface Backup {
  version: 1;
  exportedAt: string;
  words: Word[];
  decks: Deck[];
  texts: TextDocument[];
  videos: Video[];
  reviews: ReviewHistory[];
  statistics: DailyStatistics[];
  recent: RecentItem[];
  settings: Settings;
}
type RecordValue = Record<string, unknown>;
function object(v: unknown): asserts v is RecordValue {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Некорректный объект в резервной копии");
}
function fields(
  v: RecordValue,
  strings: string[],
  numbers: string[] = [],
  arrays: string[] = [],
) {
  for (const key of strings)
    if (typeof v[key] !== "string")
      throw new Error(`Некорректное текстовое поле: ${key}`);
  for (const key of numbers)
    if (
      typeof v[key] !== "number" ||
      !Number.isFinite(v[key]) ||
      (v[key] as number) < 0
    )
      throw new Error(`Некорректное числовое поле: ${key}`);
  for (const key of arrays)
    if (
      !Array.isArray(v[key]) ||
      !(v[key] as unknown[]).every((x) => typeof x === "string")
    )
      throw new Error(`Некорректный список: ${key}`);
}
function language(v: RecordValue) {
  if (!["de", "en", "fr", "es"].includes(String(v.language)))
    throw new Error("Неподдерживаемый язык в резервной копии");
}
export function parseBackup(text: string): Backup {
  const raw: unknown = JSON.parse(text);
  object(raw);
  if (raw.version !== 1)
    throw new Error("Неподдерживаемая версия резервной копии");
  const tables = [
    "words",
    "decks",
    "texts",
    "videos",
    "reviews",
    "statistics",
    "recent",
  ] as const;
  for (const table of tables) {
    if (!Array.isArray(raw[table]))
      throw new Error(`В копии отсутствует ${table}`);
    const seen = new Set<string>();
    for (const item of raw[table] as unknown[]) {
      object(item);
      const key =
        table === "statistics" ? "date" : table === "recent" ? "key" : "id";
      fields(item, [key]);
      if (!item[key] || seen.has(item[key] as string))
        throw new Error(`Повторяющийся или пустой идентификатор в ${table}`);
      seen.add(item[key] as string);
    }
  }
  const words = (raw.words as RecordValue[]).map((w) => {
    fields(
      w,
      [
        "id",
        "term",
        "translation",
        "language",
        "nativeLanguage",
        "definition",
        "example",
        "pronunciation",
        "ipa",
        "partOfSpeech",
        "gender",
        "article",
        "plural",
        "verbForms",
        "synonyms",
        "antonyms",
        "notes",
        "type",
        "preposition",
        "grammaticalCase",
      ],
      [
        "createdAt",
        "updatedAt",
        "nextReviewAt",
        "reviewCount",
        "correctCount",
        "incorrectCount",
        "interval",
        "difficulty",
      ],
      ["tags"],
    );
    language(w);
    if (
      !["new", "learning", "review", "mastered", "ignored"].includes(
        String(w.status),
      )
    )
      throw new Error("Некорректный статус слова");
    if (
      ![
        "word",
        "phrase",
        "idiom",
        "collocation",
        "phrasal verb",
        "sentence",
      ].includes(String(w.type))
    )
      throw new Error("Некорректный тип слова");
    if (!w.term || !w.translation) throw new Error("Пустое слово или перевод");
    for (const key of ["favorite", "separable", "reflexive"])
      if (typeof w[key] !== "boolean")
        throw new Error(`Некорректное поле ${key}`);
    return newWord(w as unknown as Word);
  });
  for (const d of raw.decks as RecordValue[]) {
    fields(
      d,
      ["title", "description"],
      ["createdAt", "updatedAt"],
      ["tags", "wordIds"],
    );
    language(d);
  }
  for (const t of raw.texts as RecordValue[]) {
    fields(
      t,
      ["title", "content", "source"],
      ["createdAt", "updatedAt", "readingProgress"],
      ["tags"],
    );
    language(t);
    if ((t.readingProgress as number) > 100)
      throw new Error("Некорректный прогресс чтения");
  }
  for (const v of raw.videos as RecordValue[]) {
    fields(
      v,
      ["youtubeId", "url", "title"],
      ["createdAt", "lastPosition"],
      ["tags"],
    );
    language(v);
    if (
      !/^[\w-]{11}$/.test(String(v.youtubeId)) ||
      !Array.isArray(v.subtitles) ||
      !v.subtitles.every(isSubtitle)
    )
      throw new Error("Некорректное видео или субтитры");
  }
  for (const table of ["decks", "texts", "videos"] as const)
    for (const v of raw[table] as RecordValue[])
      if (typeof v.favorite !== "boolean")
        throw new Error("Некорректное избранное");
  for (const r of raw.reviews as RecordValue[]) {
    fields(r, ["wordId"], ["timestamp", "responseTime"]);
    if (!["again", "hard", "good", "easy"].includes(String(r.result)))
      throw new Error("Некорректная оценка повторения");
  }
  for (const d of raw.statistics as RecordValue[]) {
    fields(
      d,
      ["date"],
      [
        "wordsAdded",
        "wordsReviewed",
        "correctAnswers",
        "incorrectAnswers",
        "studyMinutes",
        "readingMinutes",
        "listeningMinutes",
      ],
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.date)))
      throw new Error("Некорректная дата статистики");
  }
  for (const r of raw.recent as RecordValue[]) {
    fields(r, ["id", "title", "kind"], ["timestamp"]);
    if (!["decks", "vocabulary", "reader", "videos"].includes(String(r.kind)))
      throw new Error("Некорректная история");
  }
  const ids = new Set(words.map((w) => w.id));
  for (const d of raw.decks as unknown as Deck[])
    if (d.wordIds.some((id) => !ids.has(id)))
      throw new Error("Колода ссылается на отсутствующее слово");
  object(raw.settings);
  const settings = { ...defaultSettings, ...raw.settings };
  if (
    !["de", "en", "fr", "es"].includes(settings.learningLanguage) ||
    !["light", "dark", "system"].includes(settings.theme) ||
    !["forward", "reverse"].includes(settings.direction) ||
    typeof settings.nativeLanguage !== "string"
  )
    throw new Error("Некорректные настройки");
  for (const key of [
    "newWordsGoal",
    "reviewsGoal",
    "minutesGoal",
    "fontSize",
    "lineHeight",
    "textWidth",
    "longestStreak",
  ] as const)
    if (
      typeof settings[key] !== "number" ||
      !Number.isFinite(settings[key]) ||
      settings[key] < 0
    )
      throw new Error("Некорректные числовые настройки");
  for (const key of ["autoPronounce", "readerDark", "notifications"] as const)
    if (typeof settings[key] !== "boolean")
      throw new Error("Некорректные настройки");
  object(settings.matchBest);
  if (
    Object.values(settings.matchBest).some(
      (v) => typeof v !== "number" || !Number.isFinite(v) || v < 0,
    )
  )
    throw new Error("Некорректные рекорды");
  return { ...raw, words, settings } as unknown as Backup;
}
export async function createBackup(): Promise<Backup> {
  return db.transaction("r", db.tables, async () => ({
    version: 1 as const,
    exportedAt: new Date().toISOString(),
    words: await db.words.toArray(),
    decks: await db.decks.toArray(),
    texts: await db.texts.toArray(),
    videos: await db.videos.toArray(),
    reviews: await db.reviews.toArray(),
    statistics: await db.statistics.toArray(),
    recent: await db.recent.toArray(),
    settings: useSettings.getState().settings,
  }));
}
export async function restoreBackup(backup: Backup) {
  const validated = parseBackup(JSON.stringify(backup));
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) await table.clear();
    await db.words.bulkPut(validated.words);
    await db.decks.bulkPut(validated.decks);
    await db.texts.bulkPut(validated.texts);
    await db.videos.bulkPut(validated.videos);
    await db.reviews.bulkPut(validated.reviews);
    await db.statistics.bulkPut(validated.statistics);
    await db.recent.bulkPut(validated.recent);
  });
  useSettings.getState().update(validated.settings);
}
