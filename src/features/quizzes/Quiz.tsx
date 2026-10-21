import { Settings2 } from "lucide-react";
import { Meter } from "../../components/UI";
import { QuizResults } from "./QuizResults";
import { QuestionCard } from "./QuestionCard";
import { QuizConfiguration } from "./QuizConfiguration";
import { useQuizSession, type QuizOptions } from "./useQuizSession";
export function Quiz({
  words,
  mode,
  deckId,
  title = "Выбранные материалы",
}: QuizOptions) {
  const {
    savedResultId,
    mastered,
    learningTotal,
    count,
    setCount,
    types,
    setTypes,
    direction,
    setDirection,
    settingsOpen,
    setSettingsOpen,
    questions,
    results,
    index,
    session,
    pending,
    finished,
    preview,
    plannedCount,
    isTopic,
    nativeName,
    start,
    answer,
    checkTest,
  } = useQuizSession({ words, mode, deckId, title });
  if (finished)
    return (
      <QuizResults
        answers={questions.flatMap((_, i) => (results[i] ? [results[i]] : []))}
        start={start}
        resultId={savedResultId}
        learningSummary={
          mode === "learn" ? { mastered, total: learningTotal } : undefined
        }
      />
    );
  const visible = questions.length
    ? mode === "test"
      ? questions.map((q, i) => ({ q, i }))
      : [{ q: questions[index], i: index }]
    : preview.map((q, i) => ({ q, i }));
  return (
    <div
      className={`quiz-workspace ${mode === "test" ? "test-workspace" : "learn-workspace"}`}
    >
      <div className="quiz-session-header">
        <div>
          <strong>{mode === "test" ? "Тест" : "Заучивание"}</strong>
          <span>{title}</span>
        </div>
        <span className="quiz-session-count" aria-live="polite">
          {mode === "learn" ? mastered : Object.keys(results).length} /{" "}
          {mode === "learn" ? learningTotal : questions.length || plannedCount}
        </span>
        <button
          className="icon-button"
          aria-label={
            mode === "test" ? "Настроить тест" : "Настроить заучивание"
          }
          disabled={pending}
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 size={22} />
        </button>
      </div>
      <Meter
        value={mode === "learn" ? mastered : Object.keys(results).length}
        total={
          mode === "learn" ? learningTotal : questions.length || plannedCount
        }
      />
      {mode === "learn" && !!questions.length && (
        <p className="hint adaptive-status" aria-live="polite">
          Закреплено: {mastered} из {learningTotal}. Новые слова закрепляем
          двумя верными ответами подряд; ошибки возвращаются через несколько
          заданий.
        </p>
      )}
      <div className="quiz-question-list">
        {visible.map(({ q, i }) => (
          <QuestionCard
            key={`${session}-${i}`}
            question={q}
            number={i + 1}
            total={questions.length || plannedCount}
            result={mode === "learn" ? results[i] : undefined}
            draft={mode === "test" ? results[i] : undefined}
            deferred={mode === "test"}
            adaptive={mode === "learn"}
            disabled={pending || !questions.length || settingsOpen}
            onAnswer={(value, correct, incorrectIds) =>
              void answer(i, value, correct, incorrectIds)
            }
          />
        ))}
      </div>
      {mode === "test" && !!questions.length && (
        <div className="test-submit-bar">
          <span aria-live="polite">
            Ответов: {Object.keys(results).length} из {questions.length}
          </span>
          <button
            className="button"
            disabled={
              pending || Object.keys(results).length !== questions.length
            }
            onClick={() => void checkTest()}
          >
            {pending ? "Проверяем…" : "Проверить тест"}
          </button>
        </div>
      )}
      {!questions.length && !settingsOpen && (
        <button className="button" onClick={() => setSettingsOpen(true)}>
          Настроить {mode === "test" ? "тест" : "практику"}
        </button>
      )}
      {settingsOpen && (
        <QuizConfiguration
          mode={mode}
          title={title}
          wordCount={words.length}
          language={words[0]?.language ?? "de"}
          isTopic={isTopic}
          nativeName={nativeName}
          count={count}
          setCount={setCount}
          direction={direction}
          setDirection={setDirection}
          types={types}
          setTypes={setTypes}
          onStart={() => start()}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
