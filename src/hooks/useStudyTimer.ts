import { useEffect } from "react";
import { trackActivity } from "../services/repositories";
import { reportError } from "../store/useUI";
type StudyKind = "readingMinutes" | "listeningMinutes";
export function studyInterval(
  kind: StudyKind,
  visible: boolean,
  elapsed: number,
  idle: number,
) {
  if (!visible || (kind === "readingMinutes" && idle >= 90000)) return 0;
  return Math.max(0, Math.min(elapsed, 15000)) / 60000;
}
export function useStudyTimer(kind: StudyKind, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    let active = Date.now(),
      previous = active;
    const activity = () => {
      active = Date.now();
    };
    const visibility = () => {
      previous = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("scroll", activity);
    document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      const now = Date.now();
      const minutes = studyInterval(
        kind,
        document.visibilityState === "visible",
        now - previous,
        now - active,
      );
      previous = now;
      if (minutes)
        void trackActivity({ [kind]: minutes, studyMinutes: minutes }).catch(
          reportError,
        );
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("scroll", activity);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [kind, enabled]);
}
