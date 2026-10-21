import { Link, useParams } from "react-router-dom";
import { Check, X, Trophy, ArrowLeft } from "lucide-react";
import { useData } from "../hooks/useData";
import { Empty, Loading } from "../components/UI";
export function TestResultPage() {
  const data = useData(["testResults"]);
  const { id } = useParams();
  if (!data) return <Loading />;
  const result = data.testResults.find((r) => r.id === id);
  if (!result)
    return (
      <Empty
        title="Результат не найден"
        description="Пройдите тест, чтобы сохранить результат."
      />
    );
  const score = Math.round(
    (result.answers.filter((a) => a.correct).length /
      Math.max(1, result.answers.length)) *
      100,
  );
  return (
    <div className="saved-test-result">
      <Link className="back-link" to="/library?tab=tests">
        <ArrowLeft size={17} />
        Пробные тесты
      </Link>
      <div className="test-score-hero">
        <Trophy size={44} />
        <h1>{score}% правильных ответов</h1>
        <p>
          {result.title} · {new Date(result.timestamp).toLocaleString("ru-RU")}
        </p>
        <Link
          className="button"
          to={`/learn?mode=test${result.deckId ? `&deck=${result.deckId}` : ""}`}
        >
          Пройти ещё раз
        </Link>
      </div>
      <div className="saved-test-answers">
        {result.answers.map((answer, index) => (
          <article
            className={answer.correct ? "correct" : "incorrect"}
            key={index}
          >
            <span>
              {answer.correct ? <Check size={22} /> : <X size={22} />}
            </span>
            <div>
              <strong>{answer.term}</strong>
              <p>Ваш ответ: {answer.given}</p>
              {!answer.correct && <p>Правильный ответ: {answer.expected}</p>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
