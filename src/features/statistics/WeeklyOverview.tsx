import { Link } from "react-router-dom";
import { recentDays } from "./metrics";
import type { DailyStatistics, Word } from "../../types";
export function WeeklyOverview({
  days,
  words,
}: {
  days: DailyStatistics[];
  words: Word[];
}) {
  const recent = recentDays(7).map((date) => ({
    date,
    day: days.find((d) => d.date === date),
  }));
  const maximum = Math.max(1, ...recent.map((d) => d.day?.wordsReviewed ?? 0));
  const today = recent.at(-1)?.date;
  const learnedToday = words.filter(
    (w) =>
      w.status === "mastered" &&
      w.lastReviewedAt &&
      new Date(w.lastReviewedAt).toLocaleDateString("sv-SE") === today,
  ).length;
  return (
    <section className="panel weekly-overview">
      <div>
        <span className="eyebrow">ПОСЛЕДНИЕ 7 ДНЕЙ</span>
        <h2>Из маленьких привычек растёт уверенность</h2>
        <p className="hint">
          В изучении:{" "}
          {
            words.filter(
              (w) => w.status === "learning" || w.status === "review",
            ).length
          }{" "}
          · Знакомых: {words.filter((w) => w.status === "mastered").length} ·{" "}
          Освоено сегодня: {learnedToday}
        </p>
        <Link className="text-link" to="/progress">
          Посмотреть прогресс ↗
        </Link>
      </div>
      <div className="week-bars">
        {recent.map(({ date, day }) => (
          <div
            key={date}
            title={`${date}: ${day?.wordsReviewed ?? 0} повторений`}
          >
            <span>{day?.wordsReviewed ?? 0}</span>
            <div>
              <i
                style={{
                  height: `${Math.max(5, ((day?.wordsReviewed ?? 0) / maximum) * 100)}%`,
                }}
              />
            </div>
            <small>
              {new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
                weekday: "short",
              })}
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}
