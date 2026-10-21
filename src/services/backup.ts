import { validateSubjects } from "./subjectValidation";
import { languages } from "../utils/format";
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
  SetDraft,
  Collection,
  Solution,
  TestResult,
} from "../types";
import { withDefaultSettings } from "../store/settingsDefaults";
import { useSettings } from "../store/useSettings";
import { newWord } from "./wordModel";
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
  drafts: SetDraft[];
  collections: Collection[];
  solutions: Solution[];
  testResults: TestResult[];
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
function language(v: RecordValue, validSubjects: Set<string>) {
  if (!validSubjects.has(String(v.language)))
    throw new Error("Неподдерживаемый язык в резервной копии");
}
function validateCardMedia(card: RecordValue) {
  for (const key of ["acceptedTerms", "acceptedTranslations"]) {
    const values = card[key];
    if (
      values !== undefined &&
      (!Array.isArray(values) ||
        values.some((value) => typeof value !== "string"))
    )
      throw new Error("Некорректные допустимые ответы карточки");
  }
  for (const key of ["image", "termImage"]) {
    const value = card[key];
    if (
      value !== undefined &&
      (typeof value !== "string" ||
        !/^data:image\/(png|jpeg|webp|gif);base64,/.test(value))
    )
      throw new Error("Некорректное изображение карточки");
  }
  for (const key of ["bold", "italic", "underline", "highlight"])
    if (card[key] !== undefined && typeof card[key] !== "boolean")
      throw new Error("Некорректное оформление карточки");
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
  for (const table of [
    "drafts",
    "collections",
    "solutions",
    "testResults",
  ] as const) {
    if (raw[table] === undefined) raw[table] = [];
    if (!Array.isArray(raw[table]))
      throw new Error(`Некорректная таблица ${table}`);
    const ids = new Set<string>();
    for (const entry of raw[table] as unknown[]) {
      object(entry);
      fields(entry, ["id"]);
      if (!entry.id || ids.has(String(entry.id)))
        throw new Error(`Повторяющийся идентификатор в ${table}`);
      ids.add(String(entry.id));
    }
  }
  object(raw.settings);
  const settings = withDefaultSettings(raw.settings as Partial<Settings>);
  validateSubjects(settings.customSubjects);
  const validSubjects = new Set([
    ...Object.keys(languages),
    ...settings.customSubjects.map((subject) => subject.id),
  ]);
  for (const d of raw.drafts as RecordValue[]) {
    fields(
      d,
      ["title", "description", "nativeLanguage"],
      ["createdAt", "updatedAt"],
    );
    language(d, validSubjects);
    if (d.sourceDeckId !== undefined && typeof d.sourceDeckId !== "string")
      throw new Error("Некорректный исходный модуль");
    if (!Array.isArray(d.cards))
      throw new Error("Некорректные карточки черновика");
    const cardIds = new Set<string>();
    for (const card of d.cards) {
      object(card);
      fields(card, ["id", "term", "definition"]);
      if (!card.id || cardIds.has(String(card.id)))
        throw new Error("Повторяющийся идентификатор карточки");
      cardIds.add(String(card.id));
      if (card.wordId !== undefined && typeof card.wordId !== "string")
        throw new Error("Некорректный термин черновика");
      validateCardMedia(card);
    }
  }
  const deckIds = new Set((raw.decks as RecordValue[]).map((d) => d.id));
  for (const c of raw.collections as RecordValue[]) {
    fields(
      c,
      ["title", "description"],
      ["createdAt", "updatedAt"],
      ["deckIds"],
    );
    if (
      !["folder", "class", "course"].includes(String(c.kind)) ||
      (c.language !== undefined && !validSubjects.has(String(c.language))) ||
      (c.deckIds as string[]).some((id) => !deckIds.has(id))
    )
      throw new Error("Некорректная коллекция");
  }
  for (const collection of raw.collections as RecordValue[]) {
    if (
      collection.folderId !== undefined &&
      (collection.kind !== "course" ||
        typeof collection.folderId !== "string" ||
        !(raw.collections as RecordValue[]).some(
          (folder) =>
            folder.id === collection.folderId && folder.kind === "folder",
        ))
    )
      throw new Error("Некорректная папка модуля");
  }
  for (const solution of raw.solutions as RecordValue[])
    fields(
      solution,
      ["title", "question", "answer"],
      ["createdAt", "updatedAt"],
    );
  for (const result of raw.testResults as RecordValue[]) {
    fields(result, ["title"], ["timestamp"]);
    if (!Array.isArray(result.answers))
      throw new Error("Некорректные ответы теста");
    for (const answer of result.answers) {
      object(answer);
      fields(answer, ["term", "expected", "given"]);
      if (typeof answer.correct !== "boolean")
        throw new Error("Некорректная оценка теста");
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
    language(w, validSubjects);
    validateCardMedia(w);
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
    language(d, validSubjects);
  }
  for (const t of raw.texts as RecordValue[]) {
    fields(
      t,
      ["title", "content", "source"],
      ["createdAt", "updatedAt", "readingProgress"],
      ["tags"],
    );
    language(t, validSubjects);
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
    language(v, validSubjects);
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
    if (
      !["decks", "modules", "vocabulary", "reader", "videos"].includes(
        String(r.kind),
      )
    )
      throw new Error("Некорректная история");
  }
  const ids = new Set(words.map((w) => w.id));
  for (const d of raw.decks as unknown as Deck[])
    if (d.wordIds.some((id) => !ids.has(id)))
      throw new Error("Колода ссылается на отсутствующее слово");
  if (
    !validSubjects.has(settings.learningLanguage) ||
    !["light", "dark", "system"].includes(settings.theme) ||
    !["forward", "reverse"].includes(settings.direction) ||
    typeof settings.nativeLanguage !== "string"
  )
    throw new Error("Некорректные настройки");
  for (const key of [
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
  for (const key of [
    "autoPronounce",
    "readerDark",
    "strictAnswerCase",
    "strictAnswerArticles",
  ] as const)
    if (typeof settings[key] !== "boolean")
      throw new Error("Некорректные настройки");
  for (const key of ["profileName", "profileAvatar"] as const)
    if (settings[key] !== undefined && typeof settings[key] !== "string")
      throw new Error("Некорректный профиль");
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
    drafts: await db.drafts.toArray(),
    collections: await db.collections.toArray(),
    solutions: await db.solutions.toArray(),
    testResults: await db.testResults.toArray(),
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
    await db.drafts.bulkPut(validated.drafts);
    await db.collections.bulkPut(validated.collections);
    await db.solutions.bulkPut(validated.solutions);
    await db.testResults.bulkPut(validated.testResults);
  });
  useSettings.getState().update(validated.settings);
}
