import { Link } from "react-router-dom";
import { Zap, Puzzle } from "lucide-react";
import { useState } from "react";
import { useData } from "../hooks/useData";
import { Loading } from "../components/UI";
export function GamesPage() {
  const data = useData(["decks"]);
  const [deck, setDeck] = useState("");
  if (!data) return <Loading />;
  return (
    <div className="quizlet-games">
      <h1>Игры</h1>
      <p className="muted">Закрепляйте термины и улучшайте свой рекорд.</p>
      <label className="game-deck-picker">
        Учебный модуль
        <select value={deck} onChange={(e) => setDeck(e.target.value)}>
          <option value="">Весь словарь</option>
          {data.decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.title}
            </option>
          ))}
        </select>
      </label>
      <div className="game-tiles">
        {[
          [
            "match",
            "Подбор",
            "Находите пары терминов и определений на время.",
            Puzzle,
          ],
          [
            "blast",
            "Blast",
            "Выбирайте правильные ответы, пока не истекло время.",
            Zap,
          ],
        ].map(([mode, title, description, Icon]) => {
          const GameIcon = Icon as typeof Puzzle;
          return (
            <Link
              key={String(mode)}
              className={`game-tile game-${mode}`}
              to={`/learn?mode=${mode}${deck ? `&deck=${deck}` : ""}`}
            >
              <GameIcon size={48} />
              <h2>{String(title)}</h2>
              <p>{String(description)}</p>
              <span className="button">Играть</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
