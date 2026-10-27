import { collectionsForLanguage } from "../services/libraryScope";
import { useSubjectNames } from "../hooks/useSubjectNames";
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Folder,
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  ArrowLeft,
} from "lucide-react";

import { useSettings } from "../store/useSettings";
import { collectionDeckIds, deleteCollection } from "../services/collections";
import { useData } from "../hooks/useData";
import { Loading, Empty, Confirm } from "../components/UI";
import { CollectionEditor } from "../components/CollectionEditor";
import { remember } from "../services/repositories";
import { perform } from "../store/useUI";
import type { Collection } from "../types";
export function CollectionsPage({
  kind = "folder",
}: {
  kind?: Exclude<Collection["kind"], "class">;
}) {
  const languages = useSubjectNames();
  const data = useData(["collections", "decks"]);
  const language = useSettings((state) => state.settings.learningLanguage);
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState(false);
  const [remove, setRemove] = useState(false);
  const collections = data
    ? collectionsForLanguage(data.collections, data.decks, language)
    : [];
  const opened = collections.find((c) => c.id === id && c.kind === kind);
  useEffect(() => {
    if (opened?.kind === "course")
      void remember("modules", opened.id, opened.title);
  }, [opened?.id, opened?.title]);
  if (!data) return <Loading />;
  const collection = collections.find((c) => c.id === id && c.kind === kind);
  const children = collections.filter(
    (item) =>
      kind === "folder" && item.kind === "course" && item.folderId === id,
  );
  const childDecks = new Set(children.flatMap((item) => item.deckIds));
  const allDeckIds = collection
    ? collectionDeckIds(collection, collections)
    : [];
  const visibleDecks = collection
    ? allDeckIds.filter(
        (deckId) => kind !== "folder" || !childDecks.has(deckId),
      )
    : [];
  const parent = collections.find((item) => item.id === collection?.folderId);
  const items = collections.filter((c) => c.kind === kind);
  const names = { folder: "Папки", course: "Модули" };
  const singular = { folder: "папку", course: "модуль" };
  const studyLanguage =
    collection?.language ??
    (kind === "course"
      ? data.decks.find((deck) => collection?.deckIds.includes(deck.id))
          ?.language
      : undefined) ??
    language;
  const Icon = kind === "course" ? BookOpen : Folder;
  if (id && !collection)
    return (
      <Empty
        title="Коллекция не найдена"
        description="Коллекция относится к другому языку или была удалена."
        action={
          <Link className="button" to="/library?tab=folders">
            В библиотеку
          </Link>
        }
      />
    );
  return (
    <div className="quizlet-collection-page">
      <Link
        className="back-link"
        to={
          parent
            ? `/folders/${parent.id}`
            : kind === "course"
              ? "/library?tab=modules"
              : "/library?tab=folders"
        }
      >
        <ArrowLeft size={17} />
        {parent?.title ?? names[kind]}
      </Link>
      <div className="clone-page-heading">
        <div>
          <span className="collection-heading-icon">
            <Icon size={28} />
          </span>
          <h1>{collection?.title ?? names[kind]}</h1>
          <p>
            {collection?.description ??
              `Собирайте колоды в ${kind === "course" ? "модули" : "папки"}.`}
          </p>
        </div>
        <div className="inline-actions">
          {collection && kind === "folder" && (
            <button
              className="button secondary"
              onClick={() => setParams({ new: "module" })}
            >
              <Plus size={17} />
              Создать модуль
            </button>
          )}
          {collection ? (
            <>
              <button
                className="button secondary"
                onClick={() => setEdit(true)}
              >
                <Pencil size={17} />
                Редактировать
              </button>
              <button
                className="icon-button"
                aria-label="Удалить коллекцию"
                onClick={() => setRemove(true)}
              >
                <Trash2 size={19} />
              </button>
            </>
          ) : (
            <button className="button" onClick={() => setParams({ new: "1" })}>
              <Plus size={17} />
              Создать {singular[kind]}
            </button>
          )}
        </div>
      </div>
      {collection ? (
        <>
          <div className="collection-stats">
            {children.length ? `${children.length} модулей · ` : ""}
            {allDeckIds.length} колод
            <span>
              {kind === "course" ? languages[studyLanguage] : "Личная папка"}
            </span>
          </div>
          {!!children.length && (
            <div className="collection-grid folder-module-grid">
              {children
                .sort((a, b) =>
                  a.title.localeCompare(b.title, "ru", { numeric: true }),
                )
                .map((module) => (
                  <Link
                    className="collection-card"
                    key={module.id}
                    to={`/modules/${module.id}`}
                  >
                    <BookOpen size={25} />
                    <h2>{module.title}</h2>
                    <p>{module.deckIds.length} колод</p>
                  </Link>
                ))}
            </div>
          )}
          <div className="quizlet-set-list">
            {visibleDecks
              .flatMap((deckId) =>
                data.decks.find((deck) => deck.id === deckId)
                  ? [data.decks.find((deck) => deck.id === deckId)!]
                  : [],
              )
              .map((deck) => (
                <Link
                  className="quizlet-set-row"
                  to={`/sets/${deck.id}`}
                  key={deck.id}
                >
                  <span className="set-row-meta">
                    {deck.wordIds.length} терминов
                  </span>
                  <strong>{deck.title}</strong>
                </Link>
              ))}
          </div>
          {!allDeckIds.length && (
            <Empty
              title="Добавьте колоды"
              description="Нажмите «Редактировать», чтобы выбрать колоды из вашей библиотеки."
              action={
                <button className="button" onClick={() => setEdit(true)}>
                  Добавить колоды
                </button>
              }
            />
          )}
          <div className="collection-study-modes">
            {[
              ["flashcards", "Карточки"],
              ["learn", "Заучивание"],
              ["test", "Тест"],
              ["review", "Повторение"],
              ["match", "Подбор пар"],
            ].map(([mode, label]) => (
              <Link
                key={mode}
                className="button secondary"
                to={`/learn?mode=${mode}&collection=${collection.id}`}
              >
                {label}
              </Link>
            ))}
          </div>
          <p className="hint">
            Все колоды вместе · {languages[studyLanguage]}. Общие карточки
            изучаются один раз.
          </p>
        </>
      ) : items.length ? (
        <div className="collection-grid">
          {items.map((item) => (
            <Link
              className="collection-card"
              to={`/${kind === "course" ? "modules" : "folders"}/${item.id}`}
              key={item.id}
            >
              <Icon size={27} />
              <h2>{item.title}</h2>
              <p>{item.deckIds.length} колод</p>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title={`${names[kind]} пока не созданы`}
          description="Добавьте название, описание и выберите колоды."
          action={
            <button className="button" onClick={() => setParams({ new: "1" })}>
              Создать {singular[kind]}
            </button>
          }
        />
      )}
      {(edit || params.get("new")) && (
        <CollectionEditor
          kind={params.get("new") === "module" ? "course" : kind}
          parentFolderId={kind === "folder" ? collection?.id : undefined}
          collections={data.collections}
          collection={edit ? collection : undefined}
          decks={data.decks}
          onClose={() => {
            setEdit(false);
            setParams({});
          }}
        />
      )}
      {remove && collection && (
        <Confirm
          title={`Удалить «${collection.title}»?`}
          description="Колоды останутся в вашей библиотеке."
          onClose={() => setRemove(false)}
          onConfirm={() =>
            void perform(async () => {
              await deleteCollection(collection.id);
              window.location.assign(
                kind === "course"
                  ? "/library?tab=modules"
                  : "/library?tab=folders",
              );
            })
          }
        />
      )}
    </div>
  );
}
