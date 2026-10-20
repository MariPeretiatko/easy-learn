import type { DailyStatistics } from "../../types";
import { dateKey } from "../../utils/format";
export function meaningful(day: DailyStatistics) {
  return day.wordsReviewed > 0 || day.studyMinutes > 0;
}
export function streaks(days: DailyStatistics[], today = new Date()) {
  const active = new Set(days.filter(meaningful).map((d) => d.date));
  const cursor = new Date(today);
  if (!active.has(dateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let current = 0;
  while (active.has(dateKey(cursor))) {
    current++;
    cursor.setDate(cursor.getDate() - 1);
  }
  let longest = 0,
    run = 0;
  const keys = [...active].sort();
  let previous = "";
  for (const key of keys) {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() - 1);
    run = dateKey(d) === previous ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = key;
  }
  return { current, longest };
}
export function recentDays(count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - count + i + 1);
    return dateKey(date);
  });
}
