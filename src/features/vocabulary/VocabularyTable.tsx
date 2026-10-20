import { Star, Volume2, Pencil, Trash2, Check } from "lucide-react";
import type { Word, Deck } from "../../types";
import { perform, useUI } from "../../store/useUI";
import { WordRepository, remember } from "../../services/repositories";
import { speak } from "../../services/speech";
import { statusNames, shortDate } from "../../utils/format";
export function VocabularyTable({
  visible,
  decks,
  selected,
  setSelected,
  onDetails,
  onDelete,
}: {
  visible: Word[];
  decks: Deck[];
  selected: string[];
  setSelected: (ids: string[]) => void;
  onDetails: (id: string) => void;
  onDelete: (ids: string[]) => void;
}) {
  const openWord = useUI((s) => s.openWord);
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                aria-label="Выбрать страницу"
                checked={
                  visible.length > 0 &&
                  visible.every((w) => selected.includes(w.id))
                }
                onChange={(e) =>
                  setSelected(
                    e.target.checked
                      ? [...new Set([...selected, ...visible.map((w) => w.id)])]
                      : selected.filter(
                          (id) => !visible.some((w) => w.id === id),
                        ),
                  )
                }
              />
            </th>
            <th>СЛОВО / ПЕРЕВОД</th>
            <th>СТАТУС</th>
            <th>КОЛОДА</th>
            <th>ПОВТОРЕНИЕ</th>
            <th>СЛОЖНОСТЬ</th>
            <th>ИСТОЧНИК</th>
            <th>ДЕЙСТВИЯ</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((w) => (
            <tr key={w.id}>
              <td>
                <input
                  type="checkbox"
                  aria-label={`Выбрать ${w.term}`}
                  checked={selected.includes(w.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, w.id]
                        : selected.filter((id) => id !== w.id),
                    )
                  }
                />
              </td>
              <td>
                <button
                  className="row-link"
                  onClick={() => {
                    onDetails(w.id);
                    void perform(() => remember("vocabulary", w.id, w.term));
                  }}
                >
                  {w.term}
                </button>
                <small>{w.translation}</small>
              </td>
              <td>
                <span className={`badge ${w.status}`}>
                  {statusNames[w.status]}
                </span>
              </td>
              <td>
                {decks
                  .filter((d) => d.wordIds.includes(w.id))
                  .map((d) => d.title)
                  .join(", ") || "—"}
              </td>
              <td>
                {w.nextReviewAt <= Date.now()
                  ? "Сегодня"
                  : shortDate(w.nextReviewAt)}
              </td>
              <td>
                <button
                  className="icon-button"
                  title="Изменить сложность"
                  onClick={() =>
                    void perform(() =>
                      WordRepository.patch(w.id, {
                        difficulty: w.difficulty >= 4 ? 2 : 5,
                      }),
                    )
                  }
                >
                  {w.difficulty}/5
                </button>
              </td>
              <td>{w.sourceTitle || "Вручную"}</td>
              <td>
                <div className="row-actions">
                  <button
                    className={`icon-button ${w.favorite ? "active" : ""}`}
                    aria-label="В избранное"
                    onClick={() =>
                      void perform(() =>
                        WordRepository.patch(w.id, {
                          favorite: !w.favorite,
                        }),
                      )
                    }
                  >
                    <Star
                      size={15}
                      fill={w.favorite ? "currentColor" : "none"}
                    />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Произнести"
                    onClick={() => speak(w.term, w.language)}
                  >
                    <Volume2 size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Знаю это слово"
                    onClick={() =>
                      void perform(
                        () =>
                          WordRepository.patch(w.id, {
                            status: "mastered",
                            nextReviewAt: Date.now() + 30 * 86400000,
                          }),
                        "Слово отмечено как знакомое",
                      )
                    }
                  >
                    <Check size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Редактировать"
                    onClick={() => openWord(w)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label="Удалить слово"
                    onClick={() => onDelete([w.id])}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
