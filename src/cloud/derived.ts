import type { LearningDatabase } from "../db/database";
import { emptyDay } from "../services/repositories";
import { scheduleReview } from "../services/srs";
import { equal, type Change } from "./types";
import type { DailyStatistics, Word } from "../types";
/** Recompute affected entities, preserving deterministic ordering for concurrent events. */
export async function rebuildDerived(
  database: LearningDatabase,
  changes?: Change[],
) {
  if (changes && !changes.length) return;
  const wordIds = new Set<string>(),
    dates = new Set<string>();
  let allStatistics = !changes;
  for (const change of changes ?? []) {
    if (change.table === "words") wordIds.add(change.key);
    for (const value of [change.before, change.value]) {
      if (change.table === "reviews" && typeof value?.wordId === "string")
        wordIds.add(value.wordId);
      if (change.table === "activity" && typeof value?.date === "string")
        dates.add(value.date);
    }
    if (change.table === "preferences" && change.key === "statisticsBaseline")
      allStatistics = true;
  }
  if (changes && !wordIds.size && !dates.size && !allStatistics) return;
  const reviews = (
    await (changes
      ? database.reviews
          .where("wordId")
          .anyOf([...wordIds])
          .toArray()
      : database.reviews.toArray())
  )
    .filter((review) => review.baseline)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const byWord = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const events = byWord.get(review.wordId) ?? [];
    events.push(review);
    byWord.set(review.wordId, events);
  }
  const originals = new Map(
    (changes
      ? (await database.words.bulkGet([...wordIds])).filter(
          (word): word is Word => !!word,
        )
      : await database.words.toArray()
    ).map((word) => [word.id, word]),
  );
  const next = new Map(originals);
  const tombstones = new Map(
    (
      await database.syncMeta.bulkGet(
        [...byWord.keys()].map((id) => `deleted:words:${id}`),
      )
    )
      .filter((entry) => !!entry)
      .map((entry) => [entry!.key, entry!.value]),
  );
  const progressFields = (word: Word) => ({
    interval: word.interval,
    difficulty: word.difficulty,
    status: word.status,
    nextReviewAt: word.nextReviewAt,
    reviewCount: word.reviewCount,
    correctCount: word.correctCount,
    incorrectCount: word.incorrectCount,
    lastReviewedAt: word.lastReviewedAt,
  });
  for (const change of changes ?? []) {
    const old = change.before;
    if (
      change.table === "reviews" &&
      old?.baseline &&
      !byWord.has(String(old.wordId))
    ) {
      const current = next.get(String(old.wordId));
      if (current)
        next.set(current.id, {
          ...current,
          ...progressFields(old.baseline as Word),
        });
    }
  }
  const deckTimes = new Map<string, number>();
  for (const [id, events] of byWord) {
    if (tombstones.get(`deleted:words:${id}`)) continue;
    let progress: Word = { ...events[0].baseline! };
    for (const event of events) {
      const correct = event.result !== "again";
      progress = {
        ...progress,
        ...scheduleReview(progress, event.result, event.timestamp),
        reviewCount: progress.reviewCount + 1,
        correctCount: progress.correctCount + Number(correct),
        incorrectCount: progress.incorrectCount + Number(!correct),
        lastReviewedAt: event.timestamp,
      };
      if (event.deckId)
        deckTimes.set(
          event.deckId,
          Math.max(deckTimes.get(event.deckId) ?? 0, event.timestamp),
        );
    }
    next.set(id, {
      ...(next.get(id) ?? progress),
      ...progressFields(progress),
    });
  }
  for (const [id, word] of next) {
    if (
      word.manualProgress &&
      word.manualProgress.at > (word.lastReviewedAt ?? 0)
    )
      next.set(id, {
        ...word,
        status: word.manualProgress.status,
        nextReviewAt: word.manualProgress.nextReviewAt,
      });
  }
  const modified = [...next.values()].filter(
    (word) => !equal(word, originals.get(word.id)),
  );
  if (modified.length) await database.words.bulkPut(modified);
  const decks = await database.decks.bulkGet([...deckTimes.keys()]);
  const changedDecks = decks.flatMap((deck) =>
    deck && (deckTimes.get(deck.id) ?? 0) > (deck.lastStudiedAt ?? 0)
      ? [{ ...deck, lastStudiedAt: deckTimes.get(deck.id)! }]
      : [],
  );
  if (changedDecks.length) await database.decks.bulkPut(changedDecks);
  if (!allStatistics && !dates.size) return;
  const days = new Map<string, DailyStatistics>();
  const base = await database.syncMeta.get("statisticsBaseline");
  for (const day of (base?.value ?? []) as DailyStatistics[])
    if (allStatistics || dates.has(day.date)) days.set(day.date, { ...day });
  for (const event of await (allStatistics
    ? database.activity.toArray()
    : database.activity
        .where("date")
        .anyOf([...dates])
        .toArray())) {
    const date = String(event.date),
      day = days.get(date) ?? emptyDay(date);
    for (const [key, value] of Object.entries(
      event.patch as Record<string, number>,
    ))
      if (key in day && key !== "date" && Number.isFinite(value))
        day[key as Exclude<keyof DailyStatistics, "date">] += value;
    days.set(date, day);
  }
  const oldDays = allStatistics
    ? await database.statistics.toArray()
    : (await database.statistics.bulkGet([...dates])).filter(
        (day): day is DailyStatistics => !!day,
      );
  const oldByDate = new Map(oldDays.map((day) => [day.date, day]));
  const removed = oldDays
    .filter((day) => !days.has(day.date))
    .map((day) => day.date);
  if (removed.length) await database.statistics.bulkDelete(removed);
  const updated = [...days.values()].filter(
    (day) => !equal(day, oldByDate.get(day.date)),
  );
  if (updated.length) await database.statistics.bulkPut(updated);
}
