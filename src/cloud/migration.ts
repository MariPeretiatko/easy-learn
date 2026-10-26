import { validateSubjects } from "../services/subjectValidation";
import { markRestore } from "../db/syncMiddleware";
import { LearningDatabase, currentDatabase } from "../db/database";
import { createBackup, parseBackup, type Backup } from "../services/backup";
import { withDefaultSettings } from "../store/settingsDefaults";
import { useSettings } from "../store/useSettings";
import { wordIdentity } from "../services/wordModel";
import { equal } from "./types";
import { uid } from "../utils/format";
import { emptyDay } from "../services/repositories";
import type { DailyStatistics, Language } from "../types";
export async function guestBackup() {
  const guest = new LearningDatabase();
  try {
    const raw = localStorage.getItem("easy-learn-settings");
    const settings = withDefaultSettings(
      raw ? JSON.parse(raw).state?.settings : undefined,
    );
    return await createBackup(guest, settings);
  } finally {
    guest.close();
  }
}
export async function importGuestLibrary(input: Backup) {
  const backup = parseBackup(JSON.stringify(input));
  const currentSubjects = useSettings.getState().settings.customSubjects;
  const mergedSubjects = [...currentSubjects];
  const subjectIds = new Map<string, string>();
  const nameKey = (name: string) =>
    name.normalize("NFC").trim().toLocaleLowerCase();
  for (const subject of backup.settings.customSubjects) {
    const same = mergedSubjects.find(
      (item) =>
        item.kind === subject.kind &&
        nameKey(item.name) === nameKey(subject.name),
    );
    if (same) {
      subjectIds.set(subject.id, same.id);
      continue;
    }
    const id: Language = mergedSubjects.some((item) => item.id === subject.id)
      ? (`${subject.kind === "topic" ? "topic" : "custom"}-${uid()}` as Language)
      : subject.id;
    let name = subject.name;
    let suffix = 1;
    while (mergedSubjects.some((item) => nameKey(item.name) === nameKey(name)))
      name = `${subject.name.slice(0, 52)} — перенос ${suffix++}`;
    mergedSubjects.push({ ...subject, id, name });
    subjectIds.set(subject.id, id);
  }
  validateSubjects(mergedSubjects);
  const language = (id: string) => (subjectIds.get(id) ?? id) as Language;
  for (const record of [
    ...backup.words,
    ...backup.decks,
    ...backup.drafts,
    ...backup.texts,
    ...backup.videos,
  ])
    record.language = language(record.language);
  for (const record of [...backup.words, ...backup.drafts])
    record.nativeLanguage = language(record.nativeLanguage);
  for (const collection of backup.collections)
    if (collection.language)
      collection.language = language(collection.language);
  backup.settings.customSubjects = mergedSubjects;
  backup.settings.learningLanguage = language(backup.settings.learningLanguage);
  backup.settings.nativeLanguage = language(backup.settings.nativeLanguage);
  const database = currentDatabase();
  if (!database.owner) throw new Error("Сначала войдите в аккаунт");
  if ((await database.syncMeta.get("guestImport"))?.value)
    throw new Error("Локальная библиотека уже перенесена в этот аккаунт");
  let device = localStorage.getItem("easy-learn-device-id");
  if (!device) {
    device = crypto.randomUUID();
    localStorage.setItem("easy-learn-device-id", device);
  }
  const journalKey = `guestImport:${device}`;
  if (await database.preferences.get(journalKey))
    throw new Error("Библиотека этого устройства уже перенесена");
  const remap = new Map<string, string>();
  const comparable = (value: object) =>
    Object.fromEntries(
      Object.entries(value).filter(
        ([key]) =>
          !["id", "createdAt", "updatedAt", "nextReviewAt"].includes(key),
      ),
    );
  await database.transaction("rw", database.tables, async (tx) => {
    markRestore(tx.idbtrans);
    const personal = new Set(
      await database.syncMeta
        .where("key")
        .startsWith("personal:words:")
        .primaryKeys(),
    );
    const existing = await database.words.toArray();
    const byIdentity = new Map(
      existing.map((word) => [wordIdentity(word), word]),
    );
    const byId = new Map(existing.map((word) => [word.id, word]));
    for (const word of backup.words) {
      const duplicate = byIdentity.get(wordIdentity(word));
      const collision = byId.get(word.id);
      // Reuse an untouched catalog word. Keep a separate copy if this account
      // already has personal progress, so neither learning history is overwritten.
      const reuse =
        duplicate?.id.startsWith("catalog-") &&
        duplicate.reviewCount === 0 &&
        !personal.has(`personal:words:${duplicate.id}`);
      const id = reuse ? duplicate!.id : collision ? uid() : word.id;
      remap.set(word.id, id);
      if (!reuse || !equal(comparable(word), comparable(duplicate!)))
        await database.words.put({ ...word, id });
    }
    const deckIds = new Map<string, string>();
    for (const deck of backup.decks) {
      const collision = await database.decks.get(deck.id);
      const wordIds = deck.wordIds.map((id) => remap.get(id) ?? id);
      const unchanged =
        collision &&
        equal(comparable(collision), comparable({ ...deck, wordIds }));
      const id = collision && !unchanged ? uid() : deck.id;
      deckIds.set(deck.id, id);
      if (!unchanged)
        await database.decks.put({
          ...deck,
          id,
          ...(collision ? { title: `${deck.title} — с этого устройства` } : {}),
          wordIds,
        });
    }
    const collectionIds = new Map<string, string>();
    for (const collection of backup.collections)
      collectionIds.set(
        collection.id,
        (await database.collections.get(collection.id)) ? uid() : collection.id,
      );
    for (const collection of backup.collections)
      await database.collections.put({
        ...collection,
        id: collectionIds.get(collection.id)!,
        folderId: collection.folderId
          ? collectionIds.get(collection.folderId)
          : undefined,
        deckIds: collection.deckIds.map((id) => deckIds.get(id) ?? id),
      });
    for (const review of backup.reviews)
      await database.reviews.put({
        ...review,
        id: (await database.reviews.get(review.id)) ? uid() : review.id,
        wordId: remap.get(review.wordId) ?? review.wordId,
        baseline: undefined,
      });
    for (const text of backup.texts)
      await database.texts.put({
        ...text,
        id: (await database.texts.get(text.id)) ? uid() : text.id,
      });
    for (const video of backup.videos)
      await database.videos.put({
        ...video,
        id: (await database.videos.get(video.id)) ? uid() : video.id,
      });
    for (const draft of backup.drafts)
      await database.drafts.put({
        ...draft,
        id: (await database.drafts.get(draft.id)) ? uid() : draft.id,
        sourceDeckId: draft.sourceDeckId
          ? deckIds.get(draft.sourceDeckId)
          : undefined,
        cards: draft.cards.map((card) => ({
          ...card,
          wordId: card.wordId ? remap.get(card.wordId) : undefined,
        })),
      });
    for (const result of backup.testResults)
      await database.testResults.put({
        ...result,
        id: (await database.testResults.get(result.id)) ? uid() : result.id,
        deckId: result.deckId ? deckIds.get(result.deckId) : undefined,
      });
    for (const solution of backup.solutions)
      await database.solutions.put({
        ...solution,
        id: (await database.solutions.get(solution.id)) ? uid() : solution.id,
      });
    const old = (await database.syncMeta.get("statisticsBaseline"))?.value as
      DailyStatistics[] | undefined;
    const days = new Map((old ?? []).map((day) => [day.date, { ...day }]));
    for (const imported of backup.statistics) {
      const day = days.get(imported.date) ?? emptyDay(imported.date);
      for (const k of Object.keys(day) as (keyof DailyStatistics)[])
        if (k !== "date") day[k] += imported[k];
      days.set(day.date, day);
    }
    await database.syncMeta.put({
      key: "statisticsBaseline",
      value: [...days.values()],
    });
    await database.preferences.put({
      id: "statisticsBaseline",
      value: [...days.values()],
    });
    const current = useSettings.getState().settings;
    const settings = {
      ...current,
      customSubjects: mergedSubjects,
    };
    await database.preferences.put({ id: "settings", value: settings });
    await database.preferences.put({ id: journalKey, importedAt: Date.now() });
    await database.syncMeta.put({
      key: "guestImport",
      value: { importedAt: Date.now(), ids: [...remap] },
    });
  });
  if (currentDatabase() !== database) return;
  const settings = await database.preferences.get("settings");
  if (settings)
    useSettings.setState({
      settings: withDefaultSettings(
        settings.value as Parameters<typeof withDefaultSettings>[0],
      ),
    });
}
