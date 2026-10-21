import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  Layers,
  Plus,
  Flame,
  Sparkles,
  Check,
  Volume2,
  RotateCcw,
  BookOpen,
  Clock,
} from "lucide-react";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { Loading } from "../components/UI";
import { perform } from "../store/useUI";
import { loadDemo } from "../services/demo";
import { streaks } from "../features/statistics/metrics";
import { recentStudyItems } from "../services/recent";
import { dateKey } from "../utils/format";

export function Dashboard() {
  const data = useData([
    "words",
    "statistics",
    "recent",
    "decks",
    "collections",
    "drafts",
  ]);
  const settings = useSettings((s) => s.settings);
  if (!data) return <Loading />;
  const words = data.words.filter(
    (word) => word.language === settings.learningLanguage,
  );
  const due = words.filter(
    (word) => word.status !== "ignored" && word.nextReviewAt <= Date.now(),
  ).length;
  const day = data.statistics.find((entry) => entry.date === dateKey());
  const recent = recentStudyItems(data);
  return (
    <div className="quizlet-home hero redesigned-home">
      <section className="home-intro">
        <span className="home-eyebrow">
          <Sparkles size={17} /> Всё для вашего следующего открытия
        </span>
        <h1>Как вы хотите заниматься?</h1>
        <p>
          Запоминайте новые слова с помощью карточек, тестов и практики.
          <br />
          Учитесь так, как удобно вам.
        </p>
        <Link
          className="button home-cta"
          to={words.length ? "/learn?mode=review" : "/create-set"}
        >
          {words.length ? "Начать повторение" : "Создать первые карточки"}{" "}
          <ArrowRight size={19} />
        </Link>
        <span className="home-due">
          {words.length
            ? `${due} слов ждут повторения`
            : "Ваше следующее открытие начинается здесь"}
        </span>
      </section>
      <div className="discovery-grid">
        <Link className="discovery-card discovery-learn" to="/learn?mode=learn">
          <h2>
            Заучивание <ArrowUpRight size={21} />
          </h2>
          <p>
            От первого знакомства
            <br />
            до уверенного ответа.
          </p>
          <div className="discovery-art learn-art" aria-hidden="true">
            <small>ВСПОМНИТЕ ПЕРЕВОД</small>
            <strong>entdecken</strong>
            <span>
              открывать, узнавать <Check size={16} />
            </span>
            <em>У вас всё получится!</em>
          </div>
        </Link>
        <Link
          className="discovery-card discovery-flashcards"
          to="/learn?mode=flashcards"
        >
          <h2>
            Карточки <ArrowUpRight size={21} />
          </h2>
          <p>
            Ваши слова.
            <br />В вашем ритме.
          </p>
          <div className="discovery-art flashcard-art" aria-hidden="true">
            <small>
              DEUTSCH <Volume2 size={14} />
            </small>
            <strong>die Welt</strong>
            <span>мир</span>
            <RotateCcw size={16} />
          </div>
        </Link>
        <Link className="discovery-card discovery-test" to="/learn?mode=test">
          <h2>
            Тест <ArrowUpRight size={21} />
          </h2>
          <p>
            Проверьте знания.
            <br />
            Заметьте свой прогресс.
          </p>
          <div className="discovery-art test-art" aria-hidden="true">
            <small>ВЫБЕРИТЕ ПЕРЕВОД</small>
            <strong>путешествие</strong>
            <span>○ &nbsp; die Sprache</span>
            <span className="correct">
              ● &nbsp; die Reise <Check size={14} />
            </span>
          </div>
        </Link>
        <Link className="discovery-card discovery-match" to="/learn?mode=match">
          <h2>
            Подбор пар <ArrowUpRight size={21} />
          </h2>
          <p>
            Соединяйте слова.
            <br />
            Запоминайте играючи.
          </p>
          <div className="match-art" aria-hidden="true">
            {["das Buch", "учиться", "мир", "lernen", "книга", "die Welt"].map(
              (word) => (
                <span key={word}>{word}</span>
              ),
            )}
          </div>
        </Link>
      </div>
      <div className="home-section-heading">
        <h2>Ваше обучение сегодня</h2>
        <Link className="streak-pill" to="/progress">
          <Flame size={18} /> Серия: {streaks(data.statistics).current} дн.
        </Link>
      </div>
      <div className="home-stats">
        {(
          [
            [Layers, "К повторению", due, "/learn?mode=review"],
            [Plus, "Новые слова", day?.wordsAdded ?? 0, "/vocabulary"],
            [
              BookOpen,
              "Уже знаете",
              words.filter((word) => word.status === "mastered").length,
              "/progress",
            ],
            [
              Clock,
              "Минут занятий",
              Math.round(day?.studyMinutes ?? 0),
              "/progress",
            ],
          ] as const
        ).map(([Icon, label, value, to]) => (
          <Link key={label} to={to}>
            <span>
              <Icon size={22} />
              {label}
            </span>
            <strong>{value}</strong>
          </Link>
        ))}
      </div>
      <div className="home-section-heading">
        <h2>Продолжить обучение</h2>
        <Link className="text-link" to="/library">
          Вся библиотека <ArrowRight size={17} />
        </Link>
      </div>
      <div className="home-recent-grid">
        {recent.map((item) => (
          <Link to={item.to} key={item.key}>
            <span className="recent-icon">
              {item.kind === "modules" ? (
                <BookOpen size={23} />
              ) : (
                <Layers size={23} />
              )}
            </span>
            <small>{item.kind === "modules" ? "Модуль" : "Колода"}</small>
            <h3>{item.title}</h3>
            <ArrowUpRight size={19} />
          </Link>
        ))}
      </div>
      {!recent.length && (
        <div className="home-empty">
          <Layers size={29} />
          <h3>
            {data.decks.length
              ? "Откройте колоду из библиотеки"
              : "Начните свою коллекцию знаний"}
          </h3>
          <p>Здесь будут последние открытые модули и колоды.</p>
          <Link
            className="button secondary"
            to={data.decks.length ? "/library" : "/create-set"}
          >
            {data.decks.length ? "В библиотеку" : "Создать карточки"}
          </Link>
          {!data.decks.length && (
            <button
              className="button ghost"
              onClick={() =>
                void perform(loadDemo, "Учебная коллекция добавлена")
              }
            >
              Попробовать на примере
            </button>
          )}
        </div>
      )}
      {!!data.drafts.length && (
        <>
          <div className="home-section-heading">
            <h2>Ваши черновики</h2>
          </div>
          <div className="quizlet-set-list">
            {data.drafts.map((draft) => (
              <Link
                className="quizlet-set-row"
                key={draft.id}
                to={`/${draft.id}/autosaved`}
              >
                <span className="set-row-meta">
                  Черновик ·{" "}
                  {draft.cards.filter((card) => card.term.trim()).length}{" "}
                  терминов
                </span>
                <strong>{draft.title || "Без названия"}</strong>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
