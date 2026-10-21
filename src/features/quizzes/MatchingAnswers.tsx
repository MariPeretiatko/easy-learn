import { useEffect, useRef, useState } from "react";
import { shuffled } from "../../utils/format";
import type { Question } from "./engine";
import type { AnswerHandler } from "./types";
export function MatchingAnswers({
  question: q,
  deferred,
  disabled,
  onAnswer,
}: {
  question: Question;
  deferred: boolean;
  disabled: boolean;
  onAnswer: AnswerHandler;
}) {
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [matched, setMatched] = useState<string[]>([]);
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [wrong, setWrong] = useState<string[]>([]);
  const [rightOrder] = useState(() => shuffled(q.pairs ?? []));
  const mistakes = useRef(false);
  const incorrectPairs = useRef<string[]>([]);
  const incorrectWordIds = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const locked = disabled;
  function pair(leftId: string, rightId: string) {
    if (deferred) {
      if (locked) return;
      const next = { ...connections };
      for (const key of Object.keys(next))
        if (next[key] === rightId) delete next[key];
      next[leftId] = rightId;
      setConnections(next);
      setLeft("");
      setRight("");
      const complete = Object.keys(next).length === q.pairs?.length;
      onAnswer(
        complete
          ? q
              .pairs!.map(
                (word) =>
                  `${word.term} — ${q.pairs!.find((item) => item.id === next[word.id])?.translation}`,
              )
              .join("; ")
          : "",
        Object.entries(next).every(([left, right]) => left === right),
        [
          ...new Set(
            Object.entries(next).flatMap(([left, right]) =>
              left === right ? [] : [left, right],
            ),
          ),
        ],
      );
      return;
    }
    if (
      locked ||
      wrong.length ||
      matched.includes(leftId) ||
      matched.includes(rightId)
    )
      return;
    if (leftId === rightId) {
      const next = [...matched, rightId];
      setMatched(next);
      setLeft("");
      setRight("");
      if (next.length === q.pairs?.length)
        onAnswer(
          mistakes.current ? incorrectPairs.current.join("; ") : q.answer,
          !mistakes.current,
          [...incorrectWordIds.current],
        );
    } else {
      mistakes.current = true;
      incorrectWordIds.current.add(leftId);
      incorrectWordIds.current.add(rightId);
      incorrectPairs.current.push(
        `${q.pairs?.find((word) => word.id === leftId)?.term} — ${q.pairs?.find((word) => word.id === rightId)?.translation}`,
      );
      setWrong([leftId, rightId]);
      timer.current = setTimeout(() => {
        setWrong([]);
        setLeft("");
        setRight("");
      }, 650);
    }
  }
  return (
    <div className="quiz-pair-grid">
      <div>
        {q.pairs?.map((word) => (
          <button
            type="button"
            key={word.id}
            disabled={
              locked ||
              (!deferred && matched.includes(word.id)) ||
              !!wrong.length
            }
            className={`quiz-pair ${deferred && connections[word.id] ? "paired" : ""} ${left === word.id ? "selected" : ""} ${matched.includes(word.id) ? "correct" : ""} ${wrong[0] === word.id ? "wrong" : ""}`}
            aria-pressed={left === word.id || matched.includes(word.id)}
            onClick={() =>
              right
                ? pair(word.id, right)
                : setLeft(left === word.id ? "" : word.id)
            }
          >
            {word.term}
            {deferred && connections[word.id] && (
              <span className="pair-number">
                {q.pairs!.findIndex((item) => item.id === word.id) + 1}
              </span>
            )}
          </button>
        ))}
      </div>
      <div>
        {rightOrder.map((word) => (
          <button
            type="button"
            key={word.id}
            disabled={
              locked ||
              (!deferred && matched.includes(word.id)) ||
              !!wrong.length
            }
            className={`quiz-pair ${deferred && Object.values(connections).includes(word.id) ? "paired" : ""} ${right === word.id ? "selected" : ""} ${matched.includes(word.id) ? "correct" : ""} ${wrong[1] === word.id ? "wrong" : ""}`}
            aria-pressed={right === word.id || matched.includes(word.id)}
            onClick={() =>
              left
                ? pair(left, word.id)
                : setRight(right === word.id ? "" : word.id)
            }
          >
            {word.translation}
            {deferred && Object.values(connections).includes(word.id) && (
              <span className="pair-number">
                {q.pairs!.findIndex(
                  (item) => connections[item.id] === word.id,
                ) + 1}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
