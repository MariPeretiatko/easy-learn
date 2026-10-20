import { create } from "zustand";
import type { Word } from "../types";
interface Toast {
  id: number;
  message: string;
  error: boolean;
}
export const useUI = create<{
  toasts: Toast[];
  wordDraft: Partial<Word> | null;
  openWord: (draft?: Partial<Word>) => void;
  closeWord: () => void;
  toast: (message: string, error?: boolean) => void;
  dismiss: (id: number) => void;
}>((set) => ({
  toasts: [],
  wordDraft: null,
  openWord: (draft = {}) => set({ wordDraft: draft }),
  closeWord: () => set({ wordDraft: null }),
  toast: (message, error = false) => {
    const id = Date.now() + Math.random();
    set((s) => ({ toasts: [...s.toasts, { id, message, error }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      5000,
    );
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
export const reportError = (error: unknown) =>
  useUI
    .getState()
    .toast(
      error instanceof Error ? error.message : "Не удалось выполнить действие",
      true,
    );
export async function perform(
  action: () => Promise<unknown>,
  message?: string,
) {
  try {
    await action();
    if (message) useUI.getState().toast(message);
  } catch (error) {
    reportError(error);
  }
}
