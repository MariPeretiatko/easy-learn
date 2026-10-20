import { useEffect, useState } from "react";
import { Volume2, Plus, Check, EyeOff } from "lucide-react";
import { Modal, Loading } from "../../components/UI";
import { translationService } from "../../services/translation";
import { db } from "../../db/database";
import { normalize } from "../../utils/format";
import { newWord, WordRepository } from "../../services/repositories";
import { useUI, reportError } from "../../store/useUI";
import { useSettings } from "../../store/useSettings";
import { speak } from "../../services/speech";
import type { Language, Word, WordStatus } from "../../types";
export interface WordContext {
  language: Language;
  sourceId: string;
  sourceType: "text" | "video";
  sourceTitle: string;
  sourceTimestamp?: number;
  example?: string;
}
export function WordPopup({
  text,
  context,
  onClose,
}: {
  text: string;
  context: WordContext;
  onClose: () => void;
}) {
  const [term, setTerm] = useState(text);
  const [translation, setTranslation] = useState("");
  const [existing, setExisting] = useState<Word>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const native = useSettings((s) => s.settings.nativeLanguage);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await (text.includes(" ")
          ? translationService.translateText(text, context.language, native)
          : translationService.translateWord(text, context.language, native));
        const words = await db.words
          .where("language")
          .equals(context.language)
          .toArray();
        const found = words.find(
          (w) =>
            normalize(w.term.replace(/^(der|die|das)\s+/i, "")) ===
              normalize(result.term) || normalize(w.term) === normalize(text),
        );
        if (cancelled) return;
        setExisting(found);
        setTerm(found?.term ?? result.term);
        setTranslation(found?.translation ?? result.translation ?? "");
        setNote(
          found
            ? "Уже есть в вашем словаре"
            : result.translation
              ? "Подсказка из локального мини-словаря"
              : "Для этого слова нет локального перевода. Введите свой.",
        );
      } catch {
        if (!cancelled) setNote("Перевод недоступен. Можно добавить свой.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [text, context.language, native]);
  const draft = () => ({
    ...context,
    term,
    translation,
    nativeLanguage: native,
    type: (text.includes(" ") ? "phrase" : "word") as Word["type"],
  });
  async function mark(status: WordStatus) {
    setBusy(true);
    try {
      if (existing)
        await WordRepository.patch(existing.id, {
          status,
          ...(status === "mastered"
            ? { nextReviewAt: Date.now() + 30 * 86400000 }
            : {}),
        });
      else
        await WordRepository.save(
          newWord({
            ...draft(),
            translation: translation || "Перевод не указан",
            status,
          }),
        );
      useUI
        .getState()
        .toast(
          status === "mastered" ? "Отмечено как знакомое" : "Слово пропущено",
        );
      onClose();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={text.includes(" ") ? "Фраза в контексте" : "Новое знакомство"}
      onClose={onClose}
    >
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="split-heading">
            <h2 className="word-title">{term}</h2>
            <button
              className="icon-button"
              aria-label="Произнести слово"
              onClick={() => speak(term, context.language)}
            >
              <Volume2 />
            </button>
          </div>
          {normalize(term) !== normalize(text) && (
            <p className="hint">В тексте: {text}</p>
          )}
          <p className="hint">{note}</p>
          <label>
            Перевод
            <input
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="Введите перевод"
            />
          </label>
          {existing?.partOfSpeech && (
            <p className="hint">{existing.partOfSpeech}</p>
          )}
          <div className="inline-actions">
            <button
              className="button"
              onClick={() => {
                onClose();
                useUI
                  .getState()
                  .openWord(existing ? { ...existing, translation } : draft());
              }}
            >
              <Plus size={16} />
              {existing ? "Редактировать" : "В словарь"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void mark("mastered")}
            >
              <Check size={16} />
              Знаю
            </button>
            <button
              className="button ghost"
              disabled={busy}
              onClick={() => void mark("ignored")}
            >
              <EyeOff size={16} />
              Пропустить
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
