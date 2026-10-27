import { collectionsForLanguage } from "../services/libraryScope";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BookOpen, Layers, Search, ArrowRight } from "lucide-react";
import type { Collection, Deck, Word } from "../types";
import { Empty, PageHeading } from "./UI";

const names: Record<string, string> = {
  learn: "Заучивание",
  flashcards: "Карточки",
  test: "Тест",
  match: "Подбор пар",
  review: "Повторение",
  blast: "Blast",
};
export function StudySelection({
  mode,
  language,
  decks,
  collections,
  words,
}: {
  mode: string;
  language: string;
  decks: Deck[];
  collections: Collection[];
  words: Word[];
}) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"modules" | "decks">("modules");
  const [folder, setFolder] = useState("");
  const [query, setQuery] = useState("");
  const [moduleIds, setModules] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const availableDecks = useMemo(
    () => decks.filter((deck) => deck.language === language),
    [decks, language],
  );
  const activeWords = new Set(
    words
      .filter((word) => word.status !== "ignored" && word.language === language)
      .map((word) => word.id),
  );
  const scopedCollections = collectionsForLanguage(
    collections,
    decks,
    language,
  );
  const modules = scopedCollections.filter((item) => item.kind === "course");
  const folders = scopedCollections.filter((item) => item.kind === "folder");
  const folderDecks = new Set(
    scopedCollections.find((item) => item.id === folder)?.deckIds ?? [],
  );
  for (const module of modules.filter((item) => item.folderId === folder))
    for (const id of module.deckIds) folderDecks.add(id);
  const matches = (title: string) =>
    title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const options =
    tab === "modules"
      ? modules.filter(
          (item) =>
            (!folder ||
              item.folderId === folder ||
              item.deckIds.some((id) => folderDecks.has(id))) &&
            matches(item.title),
        )
      : availableDecks.filter(
          (item) =>
            (!folder || folderDecks.has(item.id)) && matches(item.title),
        );
  const chosenDecks = new Set(
    tab === "modules"
      ? modules
          .filter((item) => moduleIds.includes(item.id))
          .flatMap((item) => item.deckIds)
      : selected,
  );
  const chosenWords = new Set(
    availableDecks
      .filter((deck) => chosenDecks.has(deck.id))
      .flatMap((deck) => deck.wordIds),
  );
  const count = words.filter(
    (word) =>
      chosenWords.has(word.id) &&
      word.status !== "ignored" &&
      word.language === language,
  ).length;
  const reset = () => {
    setModules([]);
    setSelected([]);
  };
  return (
    <div className="study-selection">
      <PageHeading
        title={names[mode] ?? "Практика"}
        description="Выберите один или несколько модулей либо нужные колоды."
      />
      <section className="panel study-picker">
        <div
          className="study-picker-tabs"
          role="tablist"
          aria-label="Что изучать"
        >
          {(
            [
              ["modules", "Модули", BookOpen],
              ["decks", "Колоды", Layers],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key);
                reset();
                setQuery("");
              }}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
        <div className="study-picker-filters">
          <label>
            Папка / уровень
            <select
              value={folder}
              onChange={(event) => {
                setFolder(event.target.value);
              }}
            >
              <option value="">Все папки</option>
              {folders.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <label className="study-picker-search">
            <span>
              <Search size={16} /> Поиск
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                tab === "modules" ? "Название модуля" : "Название колоды"
              }
            />
          </label>
        </div>
        <p className="hint">
          {tab === "modules"
            ? "Можно выбрать несколько модулей. Общие слова учитываются один раз."
            : "Можно выбрать одну или несколько колод. Общие слова учитываются один раз."}
        </p>
        <fieldset className="study-picker-options">
          <legend>
            {tab === "modules" ? "Выберите модули" : "Выберите колоды"}
          </legend>
          {options.map((item) => {
            const ids =
              "wordIds" in item
                ? item.wordIds
                : availableDecks
                    .filter((deck) => item.deckIds.includes(deck.id))
                    .flatMap((deck) => deck.wordIds);
            const total = [...new Set(ids)].filter((id) =>
              activeWords.has(id),
            ).length;
            const parent =
              "folderId" in item
                ? folders.find((folder) => folder.id === item.folderId)
                : folders.find((folder) => folder.deckIds.includes(item.id));
            const checked =
              tab === "modules"
                ? moduleIds.includes(item.id)
                : selected.includes(item.id);
            return (
              <label
                className={`study-picker-option ${checked ? "is-selected" : ""}`}
                key={item.id}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!total}
                  onChange={() =>
                    tab === "modules"
                      ? setModules((previous) =>
                          previous.includes(item.id)
                            ? previous.filter((id) => id !== item.id)
                            : [...previous, item.id],
                        )
                      : setSelected((previous) =>
                          previous.includes(item.id)
                            ? previous.filter((id) => id !== item.id)
                            : [...previous, item.id],
                        )
                  }
                />
                <span>
                  <strong>{item.title}</strong>
                  <small>
                    {parent ? `${parent.title} · ` : ""}
                    {"deckIds" in item ? `${item.deckIds.length} колод · ` : ""}
                    {total} слов
                  </small>
                </span>
              </label>
            );
          })}
        </fieldset>
        {!options.length && (
          <Empty
            title={
              query
                ? "Ничего не найдено"
                : tab === "modules"
                  ? "В этой папке пока нет модулей"
                  : "Колоды пока не добавлены"
            }
            description="Измените фильтр или добавьте материалы в библиотеку."
            action={
              <Link className="text-link" to="/library">
                В библиотеку
              </Link>
            }
          />
        )}
        <div className="study-picker-footer">
          <span aria-live="polite">
            {count
              ? `Выбрано: ${tab === "modules" ? `${moduleIds.length} модулей · ` : ""}${chosenDecks.size} колод · ${count} слов`
              : "Выберите материалы для занятия"}
          </span>
          <button
            className="button"
            disabled={!count}
            onClick={() => {
              const params = new URLSearchParams({ mode });
              if (tab === "modules")
                for (const id of moduleIds) params.append("collection", id);
              else for (const id of selected) params.append("deck", id);
              navigate(`/learn?${params}`);
            }}
          >
            Начать занятие <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}
