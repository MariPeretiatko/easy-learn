import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Clock3,
  Flame,
  Layers,
  Plus,
  Sparkles,
  Play,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform, useUI } from "../store/useUI";
import { dateKey } from "../utils/format";
import { Loading, Meter } from "../components/UI";
import { streaks } from "../features/statistics/metrics";
import { WeeklyOverview } from "../features/statistics/WeeklyOverview";
import { loadDemo } from "../services/demo";
import { StudyModeCards } from "../components/StudyModeCards";
export function Dashboard() {
  const data = useData();
  const { settings } = useSettings();
  const openWord = useUI((s) => s.openWord);
  if (!data) return <Loading />;
  const words = data.words.filter(
    (w) => w.language === settings.learningLanguage,
  );
  const due = words.filter(
    (w) => w.status !== "ignored" && w.nextReviewAt <= Date.now(),
  );
  const today = data.statistics.find((d) => d.date === dateKey());
  const mastered = words.filter((w) => w.status === "mastered").length;
  return (
    <>
      <section className="home-intro hero">
        <div className="home-eyebrow">
          <Sparkles size={16} />
          Всё для вашего следующего открытия
        </div>
        <h1>Как вы хотите заниматься?</h1>
        <p>
          Запоминайте новые слова с помощью карточек, тестов и практики.
          <br />
          Читайте, смотрите и учитесь так, как удобно вам.
        </p>
        <Link to="/learn?mode=review" className="button home-cta">
          Начать повторение
          <ArrowRight size={18} />
        </Link>
        <div className="home-due">
          {due.length
            ? due.length + " слов ждут повторения"
            : "Ваше обучение начинается с первого слова"}
        </div>
      </section>
      <StudyModeCards />
      <div className="home-section-heading">
        <h2>Ваше обучение сегодня</h2>
        <span className="streak-pill">
          <Flame size={18} />
          Серия: {streaks(data.statistics).current} дн.
        </span>
      </div>
      {!data.words.length && !data.texts.length && (
        <div className="demo-banner">
          <div className="demo-banner-icon">
            <Layers size={25} />
          </div>
          <div>
            <strong>Познакомьтесь с Easy Learn</strong>
            <p>Попробуйте готовую учебную коллекцию или создайте свою.</p>
          </div>
          <button
            className="button secondary"
            onClick={() =>
              void perform(loadDemo, "Учебная коллекция добавлена")
            }
          >
            Попробовать на примере
          </button>
        </div>
      )}
      <div className="metric-grid">
        {[
          [
            Layers,
            "К повторению",
            due.length,
            "Готовы к новой встрече",
            "blue",
          ],
          [
            Plus,
            "Новые слова",
            today?.wordsAdded ?? 0,
            "Добавлено сегодня",
            "sand",
          ],
          [
            BookOpen,
            "Уже знаете",
            mastered,
            "Из " + words.length + " слов в словаре",
            "sage",
          ],
          [
            Clock3,
            "Время занятий",
            Math.round(today?.studyMinutes ?? 0) + " мин",
            "Практика сегодня",
            "rose",
          ],
        ].map(([Icon, label, value, caption, color]) => {
          const MetricIcon = Icon as typeof Layers;
          return (
            <div className="metric-card" key={String(label)}>
              <span className={"metric-icon " + color}>
                <MetricIcon size={22} />
              </span>
              <span className="metric-label">{String(label)}</span>
              <strong>{String(value)}</strong>
              <small>{String(caption)}</small>
            </div>
          );
        })}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h2>Продолжить обучение</h2>
            <Link to="/decks">
              Моя библиотека <ArrowUpRight size={17} />
            </Link>
          </div>
          {data.recent.length ? (
            data.recent.slice(0, 3).map((item) => (
              <Link
                className="continue-row"
                to={
                  item.kind === "vocabulary"
                    ? "/vocabulary?word=" + item.id
                    : "/" + item.kind + "/" + item.id
                }
                key={item.key}
              >
                <span className="continue-icon">
                  {item.kind === "videos" ? (
                    <Play size={22} />
                  ) : item.kind === "decks" ? (
                    <Layers size={22} />
                  ) : (
                    <BookOpen size={22} />
                  )}
                </span>
                <div>
                  <strong>{item.title}</strong>
                  <small>
                    {
                      {
                        decks: "Учебная колода",
                        reader: "Интерактивное чтение",
                        videos: "Видео",
                        vocabulary: "Слово из вашей коллекции",
                      }[item.kind]
                    }
                  </small>
                </div>
                <ArrowRight size={19} />
              </Link>
            ))
          ) : (
            <div className="start-path">
              <h3>Занимайтесь тем, что вам интересно</h3>
              <p>
                Сохраните статью, добавьте любимое видео или соберите свою
                первую колоду.
              </p>
              <Link className="text-link" to="/reader">
                Открыть библиотеку <ArrowRight size={17} />
              </Link>
            </div>
          )}
          <div className="quick-actions">
            <button onClick={() => openWord()}>
              <Plus size={18} />
              Слово
            </button>
            <Link to="/reader?add=1">
              <BookOpen size={18} />
              Текст
            </Link>
            <Link to="/videos?add=1">
              <Play size={18} />
              Видео
            </Link>
            <Link to="/decks?add=1">
              <Layers size={18} />
              Колода
            </Link>
          </div>
        </section>
        <section className="panel goals-panel">
          <div className="section-heading">
            <h2>Ваши цели на сегодня</h2>
            <Link to="/settings" aria-label="Изменить цели">
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {[
            ["Новые слова", today?.wordsAdded ?? 0, settings.newWordsGoal],
            ["Повторения", today?.wordsReviewed ?? 0, settings.reviewsGoal],
            [
              "Минуты практики",
              Math.round(today?.studyMinutes ?? 0),
              settings.minutesGoal,
            ],
          ].map(([title, value, total]) => (
            <div className="goal" key={title}>
              <div>
                <span>{title}</span>
                <strong>
                  {value} <small>/ {total}</small>
                </strong>
              </div>
              <Meter value={Number(value)} total={Number(total)} />
            </div>
          ))}
          <p className="goal-note">
            <Sparkles size={18} />
            Небольшая практика. Большая разница.
          </p>
        </section>
      </div>
      <WeeklyOverview days={data.statistics} words={words} />
    </>
  );
}
