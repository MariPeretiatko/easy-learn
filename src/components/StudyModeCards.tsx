import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Volume2,
  Sparkles,
  RotateCcw,
} from "lucide-react";
export function StudyModeCards({ deckId }: { deckId?: string }) {
  const route = (mode: string) =>
    `/learn?mode=${mode}${deckId ? `&deck=${deckId}` : ""}`;
  return (
    <div className="study-modes">
      <Link className="study-mode mode-learn" to={route("learn")}>
        <div className="study-mode-title">
          <h2>Заучивание</h2>
          <ArrowUpRight size={21} />
        </div>
        <p>
          От первого знакомства
          <br />
          до уверенного ответа.
        </p>
        <div className="mode-preview learn-preview" aria-hidden="true">
          <span className="preview-caption">ВСПОМНИТЕ ПЕРЕВОД</span>
          <strong>entdecken</strong>
          <div className="preview-input">
            открывать, узнавать <Check size={16} />
          </div>
          <span className="preview-feedback">
            <Sparkles size={14} /> Уже получается!
          </span>
        </div>
      </Link>
      <Link className="study-mode mode-flashcards" to={route("flashcards")}>
        <div className="study-mode-title">
          <h2>Карточки</h2>
          <ArrowUpRight size={21} />
        </div>
        <p>
          Ваши слова.
          <br />В вашем ритме.
        </p>
        <div className="mode-preview flash-preview" aria-hidden="true">
          <span className="preview-caption">
            DEUTSCH <Volume2 size={15} />
          </span>
          <strong>die Welt</strong>
          <span className="preview-translation">мир</span>
          <div className="preview-card-footer">
            <span>Слово за словом</span>
            <RotateCcw size={14} />
          </div>
        </div>
      </Link>
      <Link className="study-mode mode-test" to={route("test")}>
        <div className="study-mode-title">
          <h2>Тест</h2>
          <ArrowUpRight size={21} />
        </div>
        <p>
          Проверьте знания.
          <br />
          Заметьте свой прогресс.
        </p>
        <div className="mode-preview test-preview" aria-hidden="true">
          <span className="preview-caption">ВЫБЕРИТЕ ПЕРЕВОД</span>
          <strong>путешествие</strong>
          <div className="preview-answer">
            <i />
            die Sprache
          </div>
          <div className="preview-answer answer-right">
            <i>
              <Check size={9} />
            </i>
            die Reise <Check size={14} />
          </div>
          <div className="preview-answer">
            <i />
            die Zeit
          </div>
        </div>
      </Link>
      <Link className="study-mode mode-match" to={route("match")}>
        <div className="study-mode-title">
          <h2>Подбор пар</h2>
          <ArrowUpRight size={21} />
        </div>
        <p>
          Соединяйте слова.
          <br />
          Запоминайте играючи.
        </p>
        <div className="match-preview" aria-hidden="true">
          <div>das Buch</div>
          <div className="matched-preview">учиться</div>
          <div>мир</div>
          <div className="matched-preview">lernen</div>
          <div>книга</div>
          <div>die Welt</div>
        </div>
      </Link>
    </div>
  );
}
