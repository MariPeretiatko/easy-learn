import { useRef, type MouseEvent, type TouchEvent } from "react";

export function useSwipeNavigation(previous: () => void, next: () => void) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  return {
    onTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) origin.current = { x: touch.clientX, y: touch.clientY };
      swiped.current = false;
    },
    onTouchEnd(event: TouchEvent) {
      const touch = event.changedTouches[0];
      const start = origin.current;
      origin.current = null;
      if (!touch || !start) return;
      const dx = touch.clientX - start.x,
        dy = touch.clientY - start.y;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        swiped.current = true;
        if (dx < 0) next();
        else previous();
      }
    },
    onClickCapture(event: MouseEvent) {
      if (swiped.current) {
        event.preventDefault();
        event.stopPropagation();
        swiped.current = false;
      }
    },
  };
}
