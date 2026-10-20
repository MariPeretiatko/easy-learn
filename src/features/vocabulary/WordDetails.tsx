import { Link } from "react-router-dom";
import { useEffect } from "react";
import { remember } from "../../services/repositories";
import { perform } from "../../store/useUI";
import { Volume2, Pencil } from "lucide-react";
import { Modal } from "../../components/UI";
import type { Word } from "../../types";
import { statusNames, shortDate } from "../../utils/format";
import { speak } from "../../services/speech";
import { useUI } from "../../store/useUI";
export function WordDetails({
  word: w,
  onClose,
}: {
  word: Word;
  onClose: () => void;
}) {
  useEffect(() => {
    void perform(() => remember("vocabulary", w.id, w.term));
  }, [w.id, w.term]);
  return (
    <Modal wide title="В вашем словаре" onClose={onClose}>
      <div className="split-heading">
        <div>
          <h2 className="word-title">
            {w.article} {w.term}
          </h2>
          <p className="muted">
            {w.ipa} {w.pronunciation}
          </p>
        </div>
        <div className="inline-actions">
          <button
            className="icon-button"
            title="Произнести"
            onClick={() => speak(w.term, w.language)}
          >
            <Volume2 />
          </button>
          <button
            className="button secondary"
            onClick={() => speak(w.term, w.language, true)}
          >
            Медленно
          </button>
        </div>
      </div>
      <h3>{w.translation}</h3>
      <span className={`badge ${w.status}`}>{statusNames[w.status]}</span>
      {w.example && (
        <blockquote className="detail-example">{w.example}</blockquote>
      )}
      <dl className="details-grid">
        {[
          ["Определение", w.definition],
          ["Часть речи", w.partOfSpeech],
          [
            "Род / множественное число",
            [w.gender, w.plural].filter(Boolean).join(" · "),
          ],
          ["Формы глагола", w.verbForms],
          ["Синонимы", w.synonyms],
          ["Антонимы", w.antonyms],
          [
            "Предлог / падеж",
            [w.preposition, w.grammaticalCase].filter(Boolean).join(" · "),
          ],
          ["Заметки", w.notes],
        ]
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
      </dl>
      <div className="tag-list">
        {w.tags.filter(Boolean).map((t) => (
          <span className="tag" key={t}>
            #{t}
          </span>
        ))}
      </div>
      <div className="stats-strip">
        <div>
          <strong>{w.reviewCount}</strong>
          <span>Повторений</span>
        </div>
        <div>
          <strong>{w.correctCount}</strong>
          <span>Правильно</span>
        </div>
        <div>
          <strong>{w.incorrectCount}</strong>
          <span>Ошибок</span>
        </div>
        <div>
          <strong>
            {w.reviewCount
              ? Math.round((w.correctCount / w.reviewCount) * 100)
              : 0}
            %
          </strong>
          <span>Точность</span>
        </div>
      </div>
      <p className="hint">
        Следующее повторение: {shortDate(w.nextReviewAt)} · Сложность:{" "}
        {w.difficulty}/5
      </p>
      {w.sourceId && (
        <p className="hint">
          Источник:{" "}
          <Link
            onClick={onClose}
            to={`/${w.sourceType === "video" ? "videos" : "reader"}/${w.sourceId}`}
          >
            {w.sourceTitle}
          </Link>
        </p>
      )}
      <div className="modal-actions">
        <button
          className="button"
          onClick={() => {
            onClose();
            useUI.getState().openWord(w);
          }}
        >
          <Pencil size={15} />
          Редактировать
        </button>
      </div>
    </Modal>
  );
}
