import { useSubjectNames } from "../hooks/useSubjectNames";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Folder,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  Search,
  Star,
  Trash2,
  Layers,
} from "lucide-react";
import { useDismissMenu } from "../hooks/useDismissMenu";
import { useData } from "../hooks/useData";
import { useSettings } from "../store/useSettings";
import { perform } from "../store/useUI";
import { Empty, Loading, Confirm } from "../components/UI";
import { CollectionEditor } from "../components/CollectionEditor";
import { DraftRepository } from "../services/drafts";
import { loadDemo } from "../services/demo";
import { DeckRepository } from "../services/repositories";
import { collectionDeckIds } from "../services/collections";

import type { Deck } from "../types";
export function LibraryPage() {
  const languages = useSubjectNames();
  const data = useData(["decks", "collections", "drafts", "recent"]);
  const [params, setParams] = useSearchParams();
  const [level, setLevel] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [menu, setMenu] = useState<string | null>(null);
  const [remove, setRemove] = useState<Deck | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissMenu(menuRef, !!menu, () => setMenu(null));
  const settings = useSettings((s) => s.settings);
  const requestedTab = params.get("tab") ?? "sets";
  const tab = requestedTab === "folders" ? "folders" : "modules";
  if (!data) return <Loading />;
  const matches = (title: string) =>
    title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const groupedDecks = new Set(
    data.collections
      .filter((item) => item.kind === "course")
      .flatMap((item) => item.deckIds),
  );
  const levelFolder = data.collections.find((item) => item.id === level);
  const levelDecks = new Set(
    levelFolder ? collectionDeckIds(levelFolder, data.collections) : [],
  );
  const decks = data.decks
    .filter(
      (d) =>
        d.language === settings.learningLanguage &&
        matches(d.title) &&
        (!groupedDecks.has(d.id) || !!query.trim()) &&
        (!level || levelDecks.has(d.id)),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title, "ru")
        : sort === "created"
          ? b.createdAt - a.createdAt
          : (b.lastStudiedAt ??
              data.recent.find((r) => r.kind === "decks" && r.id === b.id)
                ?.timestamp ??
              b.updatedAt) -
            (a.lastStudiedAt ??
              data.recent.find((r) => r.kind === "decks" && r.id === a.id)
                ?.timestamp ??
              a.updatedAt),
    );
  const drafts = data.drafts.filter(
    (d) =>
      d.language === settings.learningLanguage &&
      matches(d.title || "Черновик"),
  );
  const groups = new Map<string, Deck[]>();
  for (const deck of decks) {
    const date =
      sort === "created"
        ? deck.createdAt
        : (deck.lastStudiedAt ??
          data.recent.find((r) => r.kind === "decks" && r.id === deck.id)
            ?.timestamp ??
          deck.updatedAt);
    const age = (Date.now() - date) / 86400000;
    const name =
      sort === "title"
        ? "КОЛОДЫ"
        : age < 7
          ? "НА ЭТОЙ НЕДЕЛЕ"
          : new Date(date)
              .toLocaleDateString("ru-RU", { month: "long", year: "numeric" })
              .toLocaleUpperCase();
    groups.set(name, [...(groups.get(name) ?? []), deck]);
  }
  const tabs = [
    ["modules", "Модули"],
    ["folders", "Папки"],
  ];
  return (
    <div className="quizlet-library hero">
      <div className="library-heading-actions">
        <h1>Ваша библиотека</h1>
        <Link className="button" to="/create-set">
          <Plus size={18} />
          Создать карточки
        </Link>
      </div>
      <p className="library-language-note">
        {languages[settings.learningLanguage]} · Ваши учебные материалы
      </p>
      <div
        className="quizlet-library-tabs"
        role="tablist"
        aria-label="Библиотека"
      >
        {tabs.map(([key, title]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? "active" : ""}
            onClick={() => {
              setParams({ tab: key });
              setQuery("");
              setMenu(null);
            }}
          >
            {title}
          </button>
        ))}
      </div>
      <div className="quizlet-library-toolbar">
        {tab === "modules" && (
          <select
            aria-label="Уровень модулей"
            value={level}
            onChange={(event) => setLevel(event.target.value)}
          >
            <option value="">Все уровни</option>
            {data.collections
              .filter((item) => item.kind === "folder")
              .map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.title}
                </option>
              ))}
          </select>
        )}
        <select
          aria-label="Сортировка материалов"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="recent">Недавно просмотренные</option>
          <option value="created">Недавно созданные</option>
          <option value="title">По алфавиту</option>
        </select>
        <form onSubmit={(e) => e.preventDefault()} className="library-search">
          <input
            aria-label="Найти карточки"
            placeholder="Найти карточки"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Search size={21} />
        </form>
      </div>
      {(tab === "folders" || tab === "modules") && (
        <>
          <div className="library-subheading">
            <span>
              {tab === "folders" ? "Ваши папки" : "Тематические модули"}
            </span>
            <button
              className="button secondary"
              onClick={() =>
                setParams({ tab, new: tab === "folders" ? "folder" : "course" })
              }
            >
              <Plus size={17} />
              Создать {tab === "folders" ? "папку" : "модуль"}
            </button>
          </div>
          <div className="collection-grid">
            {data.collections
              .filter(
                (c) =>
                  c.kind === (tab === "folders" ? "folder" : "course") &&
                  matches(c.title) &&
                  (tab !== "modules" || !level || c.folderId === level) &&
                  (tab !== "modules" ||
                    (c.language ??
                      data.decks.find((deck) => c.deckIds.includes(deck.id))
                        ?.language ??
                      settings.learningLanguage) === settings.learningLanguage),
              )
              .sort((a, b) => {
                if (tab === "modules" && !level) {
                  const aFolder =
                    data.collections.find((folder) => folder.id === a.folderId)
                      ?.title ?? "";
                  const bFolder =
                    data.collections.find((folder) => folder.id === b.folderId)
                      ?.title ?? "";
                  const folderOrder = aFolder.localeCompare(bFolder, "ru", {
                    numeric: true,
                  });
                  if (folderOrder) return folderOrder;
                }
                const titleOrder = a.title.localeCompare(b.title, "ru", {
                  numeric: true,
                });
                return sort === "title"
                  ? titleOrder
                  : (sort === "created"
                      ? b.createdAt - a.createdAt
                      : b.updatedAt - a.updatedAt) || titleOrder;
              })
              .map((c) => (
                <Link
                  className="collection-card"
                  key={c.id}
                  to={`/${tab === "modules" ? "modules" : "folders"}/${c.id}`}
                >
                  <Folder size={27} />
                  {c.folderId && (
                    <small className="module-level">
                      {
                        data.collections.find(
                          (folder) => folder.id === c.folderId,
                        )?.title
                      }
                    </small>
                  )}
                  <h2>{c.title}</h2>
                  <p>
                    {c.kind === "folder"
                      ? `${data.collections.filter((item) => item.folderId === c.id).length} модулей · `
                      : ""}
                    {collectionDeckIds(c, data.collections).length} колод
                  </p>
                </Link>
              ))}
          </div>
          {tab === "folders" &&
            !data.collections.some((c) => c.kind === "folder") && (
              <Empty
                title="Организуйте колоды в папки"
                description="Объединяйте колоды по темам и изучайте весь модуль, например «Немецкий A1»."
              />
            )}
        </>
      )}
      {tab === "modules" && (
        <>
          {!!drafts.length && tab === "modules" && (
            <section className="library-date-group">
              <h2>
                <span>ВЫПОЛНЯЕТСЯ</span>
              </h2>
              <div className="quizlet-set-list">
                {drafts.map((draft) => (
                  <div className="quizlet-set-row draft-row" key={draft.id}>
                    <Link to={`/${draft.id}/autosaved`}>
                      {draft.cards.some((c) => c.term.trim()) && (
                        <span className="set-row-meta">
                          {draft.cards.filter((c) => c.term.trim()).length}{" "}
                          терминов
                        </span>
                      )}
                      <strong>{draft.title || "(Черновик)"}</strong>
                      {draft.title && (
                        <span className="draft-label">Черновик</span>
                      )}
                    </Link>
                    <button
                      className="icon-button"
                      aria-label={`Удалить черновик ${draft.title || "без названия"}`}
                      onClick={() =>
                        void perform(() => DraftRepository.delete(draft.id))
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
          {[...groups.entries()].map(([name, items]) => (
            <section className="library-date-group" key={name}>
              <h2>
                <span>{name}</span>
              </h2>
              <div className="quizlet-set-list">
                {items.map((deck) => (
                  <article className="quizlet-set-row" key={deck.id}>
                    <Link to={`/sets/${deck.id}`}>
                      <span className="set-row-meta">
                        <span>
                          {deck.wordIds.length} карточек ·{" "}
                          {languages[deck.language]}
                        </span>
                        <i />
                        <span className="inline-avatar">
                          {settings.profileAvatar ?? "🧑‍🎓"}
                        </span>
                        <span>{settings.profileName ?? "Моя библиотека"}</span>
                        {deck.favorite && (
                          <Star size={13} fill="currentColor" />
                        )}
                      </span>
                      <strong>
                        {deck.title}
                        <LockKeyhole size={13} />
                      </strong>
                    </Link>
                    <div
                      className="set-row-menu"
                      ref={menu === deck.id ? menuRef : undefined}
                    >
                      <button
                        className="icon-button"
                        aria-label={`Действия с колодой ${deck.title}`}
                        aria-expanded={menu === deck.id}
                        onClick={() =>
                          setMenu(menu === deck.id ? null : deck.id)
                        }
                      >
                        <MoreHorizontal size={20} />
                      </button>
                      {menu === deck.id && (
                        <div
                          className="row-dropdown"
                          onClick={() => setMenu(null)}
                        >
                          <Link to={`/sets/${deck.id}`}>Открыть колоду</Link>
                          <Link to={`/${deck.id}/autosaved`}>
                            Редактировать
                          </Link>
                          <button
                            onClick={() =>
                              void perform(async () => {
                                await DeckRepository.save({
                                  ...deck,
                                  favorite: !deck.favorite,
                                });
                                setMenu(null);
                              })
                            }
                          >
                            {deck.favorite
                              ? "Убрать из избранного"
                              : "В избранное"}
                          </button>
                          <button
                            onClick={() =>
                              void perform(async () => {
                                await DeckRepository.duplicate(deck);
                                setMenu(null);
                              }, "Копия создана")
                            }
                          >
                            Создать копию
                          </button>
                          <button
                            className="danger-text"
                            onClick={() => {
                              setRemove(deck);
                              setMenu(null);
                            }}
                          >
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
          {!decks.length &&
            !drafts.length &&
            !data.collections.some(
              (item) =>
                item.kind === "course" &&
                (!level || item.folderId === level) &&
                (item.language ?? settings.learningLanguage) ===
                  settings.learningLanguage,
            ) && (
              <div className="library-blank">
                <Layers size={40} />
                <h2>{query ? "Ничего не найдено" : "Ваша первая колода"}</h2>
                <p>
                  {query
                    ? "Попробуйте другое название."
                    : "Создайте карточки и начните заниматься в своём темпе."}
                </p>
                {!query && (
                  <>
                    <Link className="button" to="/create-set">
                      <Plus size={18} />
                      Создать карточки
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
                  </>
                )}
              </div>
            )}
        </>
      )}
      {params.get("new") && (
        <CollectionEditor
          kind={params.get("new") === "course" ? "course" : "folder"}
          decks={data.decks}
          collections={data.collections}
          onClose={() =>
            setParams({
              tab: params.get("new") === "course" ? "modules" : "folders",
            })
          }
        />
      )}
      {remove && (
        <Confirm
          title={`Удалить «${remove.title}»?`}
          description="Колода будет удалена. Слова и история повторений останутся в словаре."
          onClose={() => setRemove(null)}
          onConfirm={() =>
            void perform(async () => {
              await DeckRepository.delete(remove.id);
              setRemove(null);
            })
          }
        />
      )}
    </div>
  );
}
