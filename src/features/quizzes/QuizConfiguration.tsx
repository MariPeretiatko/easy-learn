import type { Dispatch, SetStateAction } from "react";
import { FileQuestion } from "lucide-react";
import { Modal } from "../../components/UI";
import { useSettings } from "../../store/useSettings";
import { useSubjectNames } from "../../hooks/useSubjectNames";
import { exerciseNames, type ExerciseType } from "./engine";
import type { QuizMode, AnswerDirection } from "./types";
export function QuizConfiguration({
  mode,
  title,
  wordCount,
  language,
  isTopic,
  nativeName,
  count,
  setCount,
  direction,
  setDirection,
  types,
  setTypes,
  onStart,
  onClose,
}: {
  mode: QuizMode;
  title: string;
  wordCount: number;
  language: string;
  isTopic: boolean;
  nativeName: string;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  direction: AnswerDirection;
  setDirection: Dispatch<SetStateAction<AnswerDirection>>;
  types: ExerciseType[];
  setTypes: Dispatch<SetStateAction<ExerciseType[]>>;
  onStart: () => void;
  onClose: () => void;
}) {
  const languages = useSubjectNames();
  const { settings, update: updateSettings } = useSettings();
  return (
    <Modal
      title={mode === "test" ? "Настройте свой тест" : "Настройте заучивание"}
      onClose={onClose}
    >
      <form
        className="quiz-config"
        onSubmit={(event) => {
          event.preventDefault();
          if (types.length && count > 0) onStart();
        }}
      >
        <div className="quiz-config-source">
          <span>{title}</span>
          <FileQuestion size={42} />
        </div>
        {mode === "test" && (
          <label className="quiz-config-row">
            <span>
              Вопросы <small>(максимум {wordCount})</small>
            </span>
            <input
              aria-label="Количество заданий"
              type="number"
              min="1"
              max={wordCount}
              value={count}
              onChange={(event) =>
                setCount(
                  Math.max(1, Math.min(wordCount, Number(event.target.value))),
                )
              }
            />
          </label>
        )}
        {mode === "learn" && (
          <p className="hint">
            В занятии — все {wordCount} карточек выбранных материалов. Знакомые
            слова проверяем реже, новые и ошибочные повторяем.
          </p>
        )}
        <label className="quiz-config-row">
          <span>Ответ</span>
          <select
            aria-label="Язык ответа"
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as AnswerDirection)
            }
          >
            <option value="learning">
              {isTopic ? "Термины" : (languages[language] ?? "Изучаемый язык")}
            </option>
            <option value="native">{nativeName}</option>
            <option value="both">И того, и другого</option>
          </select>
        </label>
        <details className="answer-rules">
          <summary>Проверка письменных ответов</summary>
          <label className="check-label">
            <input
              type="checkbox"
              checked={settings.strictAnswerCase}
              onChange={(event) =>
                updateSettings({ strictAnswerCase: event.target.checked })
              }
            />
            Учитывать регистр букв
          </label>
          {!isTopic && (
            <label className="check-label">
              <input
                type="checkbox"
                checked={settings.strictAnswerArticles}
                onChange={(event) =>
                  updateSettings({
                    strictAnswerArticles: event.target.checked,
                  })
                }
              />
              Требовать артикли в немецком
            </label>
          )}
          <p className="hint">
            Допустимые варианты можно задать в редакторе карточки. Эти правила
            применяются только к письменному вводу.
          </p>
        </details>
        <div className="quiz-config-types">
          {(Object.entries(exerciseNames) as [ExerciseType, string][])
            .filter(
              ([key]) => (mode === "learn" && !isTopic) || key !== "listening",
            )
            .map(([key, label]) => (
              <label className="quiz-config-row quiz-toggle" key={key}>
                <span>
                  {key === "typing"
                    ? mode === "learn"
                      ? "Ввод ответа"
                      : "Письменные вопросы"
                    : key === "choice"
                      ? mode === "learn"
                        ? "Выбор ответа"
                        : "Вопросы с выбором ответа"
                      : label}
                </span>
                <input
                  aria-label={label}
                  type="checkbox"
                  role="switch"
                  checked={types.includes(key)}
                  disabled={key === "matching" && wordCount < 2}
                  onChange={(event) =>
                    setTypes((previous) =>
                      event.target.checked
                        ? [...previous, key]
                        : previous.filter((value) => value !== key),
                    )
                  }
                />
                <span className="quiz-switch-track" aria-hidden="true" />
              </label>
            ))}
        </div>
        {!types.length && (
          <p className="form-error" role="status">
            Выберите хотя бы один вид заданий.
          </p>
        )}
        <div className="modal-actions">
          <button className="button" disabled={!types.length || !count}>
            Начать {mode === "test" ? "тест" : "практику"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
