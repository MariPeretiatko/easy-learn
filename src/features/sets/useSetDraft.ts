import { registerFlush, trackWrite } from "../../services/pendingWrites";
import { DraftRepository } from "../../services/drafts";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { currentDatabase } from "../../db/database";
import type { SetCard, SetDraft } from "../../types";
import { uid } from "../../utils/format";
import { useSettings } from "../../store/useSettings";
import { useUI } from "../../store/useUI";
import { editSetDraft, publishDraft } from "../../services/sets";
import { blankCard } from "./editorModel";
export function useSetDraft() {
  const [draftDatabase] = useState(currentDatabase);
  const { id } = useParams();
  const [generatedId] = useState(uid);
  const draftId = id ?? generatedId;
  const navigate = useNavigate();
  const [draft, setDraft] = useState<SetDraft | null>(null);
  const latest = useRef<SetDraft | null>(null);
  const loadedId = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const writes = useRef<Promise<unknown>>(Promise.resolve());
  const published = useRef(false);
  const [saved, setSaved] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const enqueue = (value: SetDraft) => {
    writes.current = trackWrite(
      writes.current
        .catch(() => undefined)
        .then(() => draftDatabase.drafts.put(value)),
    );
    return writes.current;
  };
  useEffect(() => {
    if (loadedId.current === draftId && latest.current) return;
    let active = true;
    published.current = false;
    void (async () => {
      const stored = await draftDatabase.drafts.get(draftId);
      if (!active) return;
      if (!stored && (await draftDatabase.decks.get(draftId))) {
        if (!active) return;
        const editId = await editSetDraft(draftId);
        if (active) navigate(`/${editId}/autosaved`, { replace: true });
        return;
      }
      const settings = useSettings.getState().settings;
      const initial = stored ?? {
        id: draftId,
        title: "",
        description: "",
        language: settings.learningLanguage,
        nativeLanguage: settings.nativeLanguage,
        cards: Array.from({ length: 2 }, blankCard),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (active) {
        await DraftRepository.save(initial);
        if (!active) return;
        latest.current = initial;
        loadedId.current = draftId;
        setDraft(initial);
        if (!id) navigate(`/${draftId}/autosaved`, { replace: true });
      }
    })().catch((e) => {
      if (active)
        setError(
          e instanceof Error ? e.message : "Не удалось открыть черновик",
        );
    });
    return () => {
      active = false;
    };
  }, [draftId, id, navigate]);
  useEffect(() => {
    if (!draft || published.current) return;
    latest.current = draft;
    setSaved(false);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (!published.current)
        void enqueue(draft)
          .then(() => {
            if (latest.current === draft) setSaved(true);
          })
          .catch(() =>
            setError(
              "Не удалось сохранить черновик. Проверьте свободное место.",
            ),
          );
    }, 450);
    return () => clearTimeout(timer.current);
  }, [draft]);
  useEffect(() => {
    const flush = () => {
      clearTimeout(timer.current);
      return latest.current && !published.current
        ? enqueue(latest.current)
        : writes.current;
    };
    const unregister = registerFlush(flush);
    const onPageHide = () => {
      void flush().catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      unregister();
      window.removeEventListener("pagehide", onPageHide);
      onPageHide();
    };
  }, []);
  const patch = (value: Partial<SetDraft>) =>
    setDraft((d) => (d ? { ...d, ...value, updatedAt: Date.now() } : d));
  const cardPatch = (cardId: string, value: Partial<SetCard>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.id === cardId ? { ...card, ...value } : card,
            ),
            updatedAt: Date.now(),
          }
        : current,
    );
  function move(cardId: string, offset: number) {
    if (!draft) return;
    const cards = [...draft.cards];
    const from = cards.findIndex((card) => card.id === cardId);
    const to = from + offset;
    if (from < 0 || to < 0 || to >= cards.length) return;
    [cards[from], cards[to]] = [cards[to], cards[from]];
    patch({ cards });
  }
  async function publish(practice = false) {
    if (!draft) return;
    setBusy(true);
    setError("");
    clearTimeout(timer.current);
    published.current = true;
    try {
      await enqueue(draft);
      if (currentDatabase() !== draftDatabase) return;
      const deckId = await publishDraft(draft);
      if (currentDatabase() !== draftDatabase) return;
      useSettings.getState().update({ learningLanguage: draft.language });
      useUI.getState().toast("Колода сохранена");
      navigate(
        practice ? `/learn?mode=learn&deck=${deckId}` : `/sets/${deckId}`,
      );
    } catch (e) {
      published.current = false;
      setError(e instanceof Error ? e.message : "Не удалось создать колоду");
      await enqueue(draft).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  }
  return {
    draft,
    saved,
    error,
    setError,
    busy,
    patch,
    cardPatch,
    move,
    publish,
  };
}
