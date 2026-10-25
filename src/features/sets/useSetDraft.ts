import { registerFlush, trackWrite } from "../../services/pendingWrites";
import {
  journalDraft,
  recoverDraft,
  clearDraftJournal,
} from "../../services/draftRecovery";
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
  const unsaved = useRef(false);
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
      const stored = recoverDraft(
        draftDatabase.owner,
        draftId,
        await draftDatabase.drafts.get(draftId),
      );
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
        await draftDatabase.drafts.put(initial);
        clearDraftJournal(draftDatabase.owner, draftId);
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
  const commit = (value: SetDraft) => {
    latest.current = value;
    unsaved.current = true;
    setSaved(false);
    setDraft(value);
    try {
      journalDraft(draftDatabase.owner, value);
    } catch {
      setError(
        "Не удалось создать аварийную копию. Не закрывайте страницу до завершения сохранения.",
      );
    }
    void enqueue(value)
      .then(() => {
        if (latest.current === value) {
          clearDraftJournal(draftDatabase.owner, value.id);
          unsaved.current = false;
          setSaved(true);
        }
      })
      .catch(() =>
        setError(
          "Не удалось сохранить черновик. Скопируйте изменения и проверьте свободное место.",
        ),
      );
  };
  useEffect(() => {
    const flush = () =>
      latest.current && !published.current
        ? enqueue(latest.current)
        : writes.current;
    const unregister = registerFlush(flush);
    const onHide = () => {
      void flush().catch(() => undefined);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") onHide();
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (unsaved.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      unregister();
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      onHide();
    };
  }, []);
  const patch = (value: Partial<SetDraft>) => {
    const current = latest.current;
    if (current) commit({ ...current, ...value, updatedAt: Date.now() });
  };
  const cardPatch = (cardId: string, value: Partial<SetCard>) => {
    const current = latest.current;
    if (current)
      commit({
        ...current,
        cards: current.cards.map((card) =>
          card.id === cardId ? { ...card, ...value } : card,
        ),
        updatedAt: Date.now(),
      });
  };
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
    published.current = true;
    try {
      await enqueue(draft);
      if (currentDatabase() !== draftDatabase) return;
      const deckId = await publishDraft(draft);
      clearDraftJournal(draftDatabase.owner, draft.id);
      unsaved.current = false;
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
