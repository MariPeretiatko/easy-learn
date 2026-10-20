import { useEffect } from "react";
import { trackActivity } from "../services/repositories";
import { reportError } from "../store/useUI";
export function useStudyTimer(
  kind: "readingMinutes" | "listeningMinutes",
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    let active = Date.now();
    const activity = () => {
      active = Date.now();
    };
    window.addEventListener("pointerdown", activity);
    window.addEventListener("keydown", activity);
    window.addEventListener("scroll", activity);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible" && Date.now() - active < 90000)
        void trackActivity({ [kind]: 0.25, studyMinutes: 0.25 }).catch(
          reportError,
        );
    }, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("pointerdown", activity);
      window.removeEventListener("keydown", activity);
      window.removeEventListener("scroll", activity);
    };
  }, [kind, enabled]);
}
