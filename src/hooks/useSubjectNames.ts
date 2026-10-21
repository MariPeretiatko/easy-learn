import { useSettings } from "../store/useSettings";
import { languages } from "../utils/format";
export function useSubjectNames(): Record<string, string> {
  const custom = useSettings((state) => state.settings.customSubjects);
  return {
    ...languages,
    ...Object.fromEntries(
      (custom ?? []).map((subject) => [subject.id, subject.name]),
    ),
  };
}
