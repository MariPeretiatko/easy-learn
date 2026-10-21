import { useEffect, useRef, type RefObject } from "react";

export function useDismissMenu(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target))
        close.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close.current();
        ref.current
          ?.querySelector<HTMLButtonElement>("button[aria-expanded]")
          ?.focus({ preventScroll: true });
      }
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
    };
  }, [open, ref]);
}
