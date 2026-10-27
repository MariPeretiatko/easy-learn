import { collectionsForLanguage } from "../../services/libraryScope";
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Check, Copy, Download } from "lucide-react";
import { Confirm, Modal } from "../../components/UI";
import { AutoTextarea } from "../../components/AutoTextarea";
import { copyText } from "../../services/clipboard";
import { download, vocabularyCSV } from "../../services/csv";
import { perform, reportError } from "../../store/useUI";
import { setCollectionDeckMembership } from "../../services/collections";
import { DeckRepository } from "../../services/repositories";
import type { Collection, Deck, Word } from "../../types";
export type SetDialog = "share" | "folders" | "delete";
export function SetDialogs({
  dialog,
  deck,
  allWords,
  collections,
  decks,
  onClose,
}: {
  dialog: SetDialog;
  deck: Deck;
  allWords: Word[];
  collections: Collection[];
  decks: Deck[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const availableCollections = collectionsForLanguage(
    collections,
    decks,
    deck.language,
  ).filter((item) => item.kind !== "class");
  return (
    <>
      {" "}
      {dialog === "folders" && (
        <Modal title="Добавить в модуль или папку" onClose={() => onClose()}>
          {availableCollections.map((c) => (
            <label className="check-label" key={c.id}>
              <input
                type="checkbox"
                checked={c.deckIds.includes(deck.id)}
                onChange={(e) =>
                  void perform(() =>
                    setCollectionDeckMembership(
                      c.id,
                      deck.id,
                      e.target.checked,
                    ),
                  )
                }
              />
              {c.title} · {c.kind === "course" ? "Модуль" : "Папка"}
            </label>
          ))}
          {!availableCollections.length && (
            <p className="muted">
              Создайте модуль или папку в библиотеке, чтобы организовать колоды.
            </p>
          )}
          <div className="modal-actions">
            <Link
              className="button secondary"
              to="/library?tab=modules&new=course"
            >
              Новый модуль
            </Link>
            <button className="button" onClick={() => onClose()}>
              Готово
            </button>
          </div>
        </Modal>
      )}
      {dialog === "share" && (
        <Modal title="Поделиться колодой" onClose={() => onClose()}>
          <p>
            Скопируйте термины или скачайте CSV, чтобы передать колоду и
            импортировать её на другом устройстве.
          </p>
          <AutoTextarea
            readOnly
            rows={6}
            value={allWords
              .map((w) => `${w.term}\t${w.translation}`)
              .join("\n")}
            aria-label="Термины для копирования"
          />
          <div className="modal-actions">
            <button
              className="button secondary"
              onClick={() =>
                void copyText(
                  allWords.map((w) => `${w.term}\t${w.translation}`).join("\n"),
                )
                  .then(() => setCopied(true))
                  .catch(reportError)
              }
            >
              {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
              {copied ? "Скопировано" : "Копировать"}
            </button>
            <button
              className="button"
              onClick={() =>
                download(
                  `${deck.title}.csv`,
                  vocabularyCSV(allWords),
                  "text/csv;charset=utf-8",
                )
              }
            >
              <Download size={17} />
              Скачать CSV
            </button>
          </div>
        </Modal>
      )}
      {dialog === "delete" && (
        <Confirm
          title={`Удалить «${deck.title}»?`}
          description="Колода будет удалена. Слова останутся в словаре."
          onClose={() => onClose()}
          onConfirm={() =>
            void perform(async () => {
              await DeckRepository.delete(deck.id);
              navigate("/library");
            })
          }
        />
      )}
    </>
  );
}
