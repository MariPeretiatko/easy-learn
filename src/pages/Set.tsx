import { useAccount } from "../cloud/auth";
import { emailInitial } from "../utils/profile";
import { SetDialogs, type SetDialog } from "../features/sets/SetDialogs";
import { useSettings } from "../store/useSettings";
import { SetPreview } from "../features/sets/SetPreview";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Copy,
  Download,
  FolderPlus,
  Layers,
  MoreHorizontal,
  Pencil,
  Printer,
  Share2,
  Star,
  Trash2,
  Volume2,
  Blocks,
  Zap,
} from "lucide-react";
import { useDismissMenu } from "../hooks/useDismissMenu";
import { useSetData } from "../features/sets/useSetData";
import {
  DeckRepository,
  WordRepository,
  remember,
} from "../services/repositories";
import { editSetDraft } from "../services/sets";
import { speak } from "../services/speech";
import { perform } from "../store/useUI";
import { download, vocabularyCSV } from "../services/csv";
import { Empty, Loading } from "../components/UI";
export function SetPage() {
  const user = useAccount((state) => state.user);
  const languages = useSubjectNames();
  const settings = useSettings((state) => state.settings);
  const { id } = useParams();
  const data = useSetData(id);
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState<SetDialog | null>(null);
  const [query, setQuery] = useState("");
  const [starred, setStarred] = useState(false);
  const [sort, setSort] = useState("original");
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissMenu(menuRef, menu, () => setMenu(false));
  const deck =
    data?.deck?.language === settings.learningLanguage ? data.deck : undefined;
  useEffect(() => {
    if (deck) void perform(() => remember("decks", deck.id, deck.title));
  }, [deck?.id, deck?.title]);
  const wordMap = new Map(data?.words.map((word) => [word.id, word]));
  const allWords =
    deck?.wordIds.flatMap((id) => {
      const word = wordMap.get(id);
      return word ? [word] : [];
    }) ?? [];
  if (!data) return <Loading />;
  if (!deck)
    return (
      <Empty
        title="Колода не найдена"
        description="Колода относится к другому языку или была удалена."
        action={
          <Link className="button" to="/library">
            Ваша библиотека
          </Link>
        }
      />
    );
  const edit = () =>
    void perform(async () => {
      const draftId = await editSetDraft(deck.id);
      navigate(`/${draftId}/autosaved`);
    });
  const list = allWords
    .filter(
      (w) =>
        (!starred || w.favorite) &&
        `${w.term} ${w.translation}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => (sort === "alphabet" ? a.term.localeCompare(b.term) : 0));
  return (
    <div className="quizlet-set-page">
      <div className="set-topline">
        <div className="set-breadcrumb">
          <Link to="/library">Ваша библиотека</Link>
          <span>/</span>
          <span>Учебная колода</span>
        </div>
        <div className="set-author-actions">
          <button
            className={`icon-button bordered ${deck.favorite ? "active" : ""}`}
            aria-label="Сохранить в избранное"
            aria-pressed={deck.favorite}
            onClick={() =>
              void perform(() =>
                DeckRepository.save({ ...deck, favorite: !deck.favorite }),
              )
            }
          >
            <Star size={20} fill={deck.favorite ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button bordered"
            aria-label="Добавить в модуль или папку"
            onClick={() => setDialog("folders")}
          >
            <FolderPlus size={20} />
          </button>
          <button
            className="icon-button bordered"
            aria-label="Редактировать колоду"
            onClick={edit}
          >
            <Pencil size={20} />
          </button>
          <button
            className="icon-button bordered"
            aria-label="Поделиться колодой"
            onClick={() => setDialog("share")}
          >
            <Share2 size={20} />
          </button>
          <div className="set-actions-menu" ref={menuRef}>
            <button
              className="icon-button bordered"
              aria-label="Другие действия"
              aria-expanded={menu}
              onClick={() => setMenu((v) => !v)}
            >
              <MoreHorizontal size={20} />
            </button>
            {menu && (
              <div className="row-dropdown" onClick={() => setMenu(false)}>
                <button onClick={edit}>
                  <Pencil size={17} />
                  Редактировать
                </button>
                <button
                  onClick={() =>
                    void perform(async () => {
                      const newId = await DeckRepository.duplicate(deck);
                      navigate(`/sets/${newId}`);
                    }, "Копия колоды создана")
                  }
                >
                  <Copy size={17} />
                  Создать копию
                </button>
                <button
                  onClick={() =>
                    download(
                      `${deck.title}.csv`,
                      vocabularyCSV(allWords),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Download size={17} />
                  Экспорт
                </button>
                <button onClick={() => window.print()}>
                  <Printer size={17} />
                  Печать
                </button>
                <button
                  className="danger-text"
                  onClick={() => {
                    setMenu(false);
                    setDialog("delete");
                  }}
                >
                  <Trash2 size={17} />
                  Удалить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <h1>{deck.title}</h1>
      <p className="set-language-label">
        {languages[deck.language]} · {allWords.length} карточек
      </p>
      <div className="set-mode-nav">
        {[
          ["flashcards", "Карточки", Layers],
          ["learn", "Заучивание", Brain],
          ["test", "Тест", BookOpen],
        ].map(([mode, title, Icon]) => {
          const ModeIcon = Icon as typeof Layers;
          return (
            <Link
              key={String(mode)}
              to={`/learn?deck=${deck.id}&mode=${mode}${starred ? "&starred=1" : ""}`}
            >
              <ModeIcon size={23} />
              <span>{String(title)}</span>
            </Link>
          );
        })}
      </div>
      <SetPreview
        key={deck.id}
        allWords={allWords}
        deckId={deck.id}
        starred={starred}
        onStarredChange={setStarred}
        edit={edit}
      />
      <Link
        className="button secondary deck-review-link"
        to={`/learn?mode=review&deck=${deck.id}`}
      >
        Повторить колоду
      </Link>
      <section className="set-games-section">
        <h2>Осваивайте материал, играя</h2>
        <div className="set-game-gallery">
          {(
            [
              ["match", "Подбор", Blocks],
              ["blast", "Blast", Zap],
            ] as const
          ).map(([mode, title, Icon]) => (
            <Link
              className={`set-game-card set-game-${mode}`}
              to={`/learn?mode=${mode}&deck=${deck.id}`}
              key={mode}
            >
              <h3>{title}</h3>
              <div className="set-game-art" aria-hidden="true">
                {Array.from({ length: mode === "match" ? 4 : 9 }, (_, i) => (
                  <span key={i}>
                    {mode === "match" ? <Icon size={30} /> : null}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <div className="set-author-row">
        <div>
          <span className="set-author-avatar">{emailInitial(user?.email)}</span>
          <span>
            <small>Создано</small>
            <strong>{settings.profileName ?? "Вами"}</strong>
          </span>
        </div>
      </div>
      {deck.description && (
        <p className="set-description">{deck.description}</p>
      )}
      <div className="set-terms-heading">
        <h2>Карточки в колоде ({allWords.length})</h2>
        <div>
          <button
            className={`button secondary ${starred ? "selected" : ""}`}
            onClick={() => setStarred((v) => !v)}
          >
            <Star size={16} />
            Отмеченные
          </button>
          <select
            aria-label="Порядок терминов"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="original">Исходный порядок</option>
            <option value="alphabet">По алфавиту</option>
          </select>
        </div>
      </div>
      <input
        className="set-term-search"
        aria-label="Найти карточку в колоде"
        placeholder="Найти термин"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="set-term-list">
        {list.map((w) => (
          <article key={w.id} className="set-term-row">
            <strong
              className={`${w.bold ? "is-bold " : ""}${w.italic ? "is-italic " : ""}${w.underline ? "is-underlined " : ""}${w.highlight ? "is-highlighted" : ""}`}
            >
              <span>{w.term}</span>
            </strong>
            <span>{w.translation}</span>
            <div>
              <button
                className="icon-button"
                aria-label={`Произнести ${w.term}`}
                onClick={() => speak(w.term, w.language)}
              >
                <Volume2 size={19} />
              </button>
              <button
                className={`icon-button ${w.favorite ? "active" : ""}`}
                aria-label={`Отметить ${w.term}`}
                onClick={() =>
                  void perform(() =>
                    WordRepository.patch(w.id, { favorite: !w.favorite }),
                  )
                }
              >
                <Star size={19} fill={w.favorite ? "currentColor" : "none"} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <button className="button secondary set-edit-terms" onClick={edit}>
        Добавить или удалить термины
      </button>
      {dialog && (
        <SetDialogs
          key={dialog}
          dialog={dialog}
          deck={deck}
          allWords={allWords}
          collections={data.collections}
          decks={data.decks}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
