import type { LearningDatabase } from "../db/database";
import { emptyDay } from "../services/repositories";
import { scheduleReview } from "../services/srs";
import type { Change } from "./types";
import type { DailyStatistics, Word } from "../types";
// Only cloud-era events have a baseline. Imported historical events are already
// included in the baseline and must never be counted a second time.
export async function rebuildDerived(
  database: LearningDatabase,
  changes?: Change[],
) {
  if (changes && !changes.length) return;
  const wordIds = new Set<string>();
  const dates = new Set<string>();
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
    .filter((r) => r.baseline)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const byWord = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = byWord.get(review.wordId) ?? [];
    list.push(review);
    byWord.set(review.wordId, list);
  }
  // Removing the last event restores its original progress seed.
  for (const change of changes ?? []) {
    const old = change.before;
    if (
      change.table === "reviews" &&
      old?.baseline &&
      !byWord.has(String(old.wordId))
    ) {
      const baseline = old.baseline as Word;
      const current = await database.words.get(String(old.wordId));
      if (current)
        await database.words.put({
          ...current,
          interval: baseline.interval,
          difficulty: baseline.difficulty,
          status: baseline.status,
          nextReviewAt: baseline.nextReviewAt,
          reviewCount: baseline.reviewCount,
          correctCount: baseline.correctCount,
          incorrectCount: baseline.incorrectCount,
          lastReviewedAt: baseline.lastReviewedAt,
        });
    }
  }
  for (const [id, events] of byWord) {
    const current = await database.words.get(id);
    const deleted = await database.syncMeta.get(`deleted:words:${id}`);
    if (deleted?.value) continue;
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
    }
    const {
      interval,
      difficulty,
      status,
      nextReviewAt,
      reviewCount,
      correctCount,
      incorrectCount,
      lastReviewedAt,
    } = progress;
    await database.words.put({
      ...(current ?? progress),
      interval,
      difficulty,
      status,
      nextReviewAt,
      reviewCount,
      correctCount,
      incorrectCount,
      lastReviewedAt,
    });
    for (const event of events) {
      if (!event.deckId) continue;
      const deck = await database.decks.get(event.deckId);
      if (deck)
        await database.decks.update(deck.id, {
          lastStudiedAt: Math.max(deck.lastStudiedAt ?? 0, event.timestamp),
        });
    }
  }
  for (const word of changes
    ? (await database.words.bulkGet([...wordIds])).filter(
        (word): word is Word => !!word,
      )
    : await database.words.toArray()) {
    if (
      word.manualProgress &&
      word.manualProgress.at > (word.lastReviewedAt ?? 0)
    )
      await database.words.update(word.id, {
        status: word.manualProgress.status,
        nextReviewAt: word.manualProgress.nextReviewAt,
      });
  }
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
    )) {
      if (key in day && key !== "date" && Number.isFinite(value))
        day[key as Exclude<keyof DailyStatistics, "date">] += value;
    }
    days.set(date, day);
  }
  if (allStatistics) await database.statistics.clear();
  else await database.statistics.bulkDelete([...dates]);
  await database.statistics.bulkPut([...days.values()]);
}
