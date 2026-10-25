import type { LearningDatabase } from "../db/database";
import { emptyDay } from "../services/repositories";
import { scheduleReview } from "../services/srs";
import type { DailyStatistics, Word } from "../types";
// Only cloud-era events have a baseline. Imported historical events are already
// included in the baseline and must never be counted a second time.
export async function rebuildDerived(database: LearningDatabase) {
  const reviews = (await database.reviews.toArray())
    .filter((r) => r.baseline)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
  const byWord = new Map<string, typeof reviews>();
  for (const review of reviews) {
    const list = byWord.get(review.wordId) ?? [];
    list.push(review);
    byWord.set(review.wordId, list);
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
  for (const word of await database.words.toArray()) {
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
    days.set(day.date, { ...day });
  for (const event of await database.activity.toArray()) {
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
  await database.statistics.clear();
  await database.statistics.bulkPut([...days.values()]);
}
