import { useEffect } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Award, BookOpen, Flame, Target, Clock3 } from "lucide-react";
import { PageHeading, Loading } from "../components/UI";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { recentDays, streaks } from "../features/statistics/metrics";
import { dateKey } from "../utils/format";
export function ProgressPage() {
  const data = useData();
  const { settings, update } = useSettings();
  const streak = streaks(data?.statistics ?? []);
  useEffect(() => {
    if (streak.longest > settings.longestStreak)
      update({ longestStreak: streak.longest });
  }, [streak.longest, settings.longestStreak, update]);
  if (!data) return <Loading />;
  const words = data.words;
  const reviews = data.statistics.reduce((n, d) => n + d.wordsReviewed, 0);
  const correct = data.statistics.reduce((n, d) => n + d.correctAnswers, 0);
  const minutes = data.statistics.reduce((n, d) => n + d.studyMinutes, 0);
  const chart = recentDays().map((date) => {
    const day = data.statistics.find((d) => d.date === date);
    return {
      date,
      label: date.slice(5).split("-").reverse().join("."),
      words: day?.wordsAdded ?? 0,
      reviews: day?.wordsReviewed ?? 0,
      minutes: Math.round(day?.studyMinutes ?? 0),
      growth: words.filter((w) => dateKey(new Date(w.createdAt)) <= date)
        .length,
    };
  });
  const weekChart = Array.from({ length: 8 }, (_, i) => {
    const end = new Date();
    end.setDate(end.getDate() - (7 - i) * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    return {
      label: `${start.getDate()}.${start.getMonth() + 1}`,
      minutes: Math.round(
        data.statistics
          .filter((d) => d.date >= dateKey(start) && d.date <= dateKey(end))
          .reduce((n, d) => n + d.studyMinutes, 0),
      ),
    };
  });
  const achievements = [
    ["Первое слово", words.length >= 1],
    ["100 слов", words.length >= 100],
    ["500 слов", words.length >= 500],
    ["1000 слов", words.length >= 1000],
    ["Первая колода", data.decks.length >= 1],
    ["Первый текст", data.texts.length >= 1],
    ["Первое видео", data.videos.length >= 1],
    ["100 повторений", reviews >= 100],
    ["7 дней подряд", streak.longest >= 7],
    ["30 дней подряд", streak.longest >= 30],
  ] as const;
  return (
    <>
      <PageHeading
        eyebrow="КАЖДЫЙ ШАГ СЧИТАЕТСЯ"
        title="Вы знаете больше, чем вчера."
        description="Ваш прогресс по всем языкам — в словах, минутах и привычках."
        actions={
          <span className="streak-pill">
            <Flame size={16} />
            Серия: {streak.current} дн.
          </span>
        }
      />
      <div className="metric-grid">
        {[
          [
            BookOpen,
            "Слов в коллекции",
            words.length,
            `${words.filter((w) => w.status === "mastered").length} уже знакомых`,
          ],
          [
            Target,
            "Точность",
            `${reviews ? Math.round((correct / reviews) * 100) : 0}%`,
            `${reviews} повторений`,
          ],
          [
            Clock3,
            "Время практики",
            `${Math.round(minutes)} мин`,
            "За всё время",
          ],
          [
            Flame,
            "Лучшая серия",
            `${Math.max(streak.longest, settings.longestStreak)} дн`,
            "Учимся понемногу",
          ],
        ].map(([Icon, title, value, caption]) => {
          const MetricIcon = Icon as typeof BookOpen;
          return (
            <div className="metric-card" key={String(title)}>
              <span className="metric-icon sage">
                <MetricIcon size={20} />
              </span>
              <span className="metric-label">{String(title)}</span>
              <strong>{String(value)}</strong>
              <small>{String(caption)}</small>
            </div>
          );
        })}
      </div>
      <div className="vocabulary-summary">
        {[
          ["Новые", words.filter((w) => w.status === "new").length],
          ["Изучаю", words.filter((w) => w.status === "learning").length],
          ["Повторяю", words.filter((w) => w.status === "review").length],
          ["Знаю", words.filter((w) => w.status === "mastered").length],
        ].map(([label, value]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="charts-grid">
        <section className="panel">
          <h2>Слова и повторения</h2>
          <p className="hint">
            Последние 14 дней · светлые столбцы — новые слова
          </p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--line)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9 }}
                  width={30}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="words"
                  name="Новые слова"
                  fill="#c5cbff"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="reviews"
                  name="Повторения"
                  fill="#6878ed"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Как растёт ваш словарь</h2>
          <p className="hint">Слова в коллекции, добавленные к каждой дате</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart}>
                <defs>
                  <linearGradient id="growth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a8b1ff" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#a8b1ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="var(--line)"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9 }}
                  width={30}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="growth"
                  name="Слов"
                  stroke="#6878ed"
                  fill="url(#growth)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Время для языка</h2>
          <p className="hint">Минуты практики за 8 недель</p>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekChart}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  width={30}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip />
                <Bar
                  dataKey="minutes"
                  name="Минуты"
                  fill="#8491f5"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>Ритм последних дней</h2>
          <div className="activity-grid">
            {recentDays(56).map((date) => {
              const day = data.statistics.find((d) => d.date === date);
              return (
                <span
                  key={date}
                  title={`${date}: ${day?.wordsReviewed ?? 0} повторений, ${Math.round(day?.studyMinutes ?? 0)} мин`}
                  className={
                    day && (day.wordsReviewed || day.studyMinutes)
                      ? "active"
                      : ""
                  }
                />
              );
            })}
          </div>
          <p className="hint">
            День засчитывается при повторении слов или активном чтении и
            слушании. Простое открытие приложения не увеличивает серию.
          </p>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 24 }}>
        <div className="section-heading">
          <h2>Маленькие победы</h2>
          <span className="hint">
            {achievements.filter(([, earned]) => earned).length} /{" "}
            {achievements.length}
          </span>
        </div>
        <div className="achievements">
          {achievements.map(([label, earned]) => (
            <div
              className={`achievement ${earned ? "earned" : ""}`}
              key={label}
            >
              <Award size={25} />
              <span>{label}</span>
              <small>{earned ? "Получено" : "Впереди"}</small>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
