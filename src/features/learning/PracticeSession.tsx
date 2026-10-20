import { useState } from "react";
import { Link } from "react-router-dom";
import type { Word } from "../../types";
import { Empty } from "../../components/UI";
import { Flashcards } from "./Flashcards";
import { Match } from "./Match";
import { Quiz } from "../quizzes/Quiz";
export function PracticeSession({
  words,
  mode,
  deckId,
}: {
  words: Word[];
  mode: string;
  deckId?: string;
}) {
  const [queue] = useState(() => [...words]);
  if (!queue.length)
    return (
      <Empty
        title={
          mode === "review"
            ? "На сегодня всё повторено"
            : "Добавьте слова для практики"
        }
        description={
          mode === "review"
            ? "Можно изучить новые слова или вернуться позже."
            : "Сохраните несколько слов в словарь, и начнём."
        }
        action={
          <Link to="/vocabulary" className="button">
            Открыть словарь
          </Link>
        }
      />
    );
  if (mode === "learn" || mode === "test")
    return <Quiz words={queue} mode={mode} deckId={deckId} />;
  if (mode === "match") return <Match words={queue} deckId={deckId} />;
  return <Flashcards words={queue} deckId={deckId} />;
}
