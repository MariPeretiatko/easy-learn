import { validateSubjects } from "./subjectValidation";
import { useSettings } from "../store/useSettings";
import { uid } from "../utils/format";
import type { StudySubject } from "../types";

export function addStudySubject(
  name: string,
  kind: StudySubject["kind"],
  speechCode?: string,
) {
  const state = useSettings.getState();
  const subject: StudySubject = {
    id: `${kind === "topic" ? "topic" : "custom"}-${uid()}`,
    name: name.trim(),
    kind,
    ...(speechCode?.trim() && kind === "language"
      ? { speechCode: speechCode.trim() }
      : {}),
  };
  const subjects = [...(state.settings.customSubjects ?? []), subject];
  validateSubjects(subjects);
  state.update({ customSubjects: subjects, learningLanguage: subject.id });
  return subject;
}
export function subjectSpeechCode(id: string) {
  const settings = useSettings.getState().settings;
  const subject = settings.customSubjects?.find((item) => item.id === id);
  return subject
    ? subject.kind === "topic"
      ? settings.nativeLanguage
      : subject.speechCode
    : id;
}

export function updateStudySubject(subject: StudySubject) {
  const state = useSettings.getState();
  if (!state.settings.customSubjects.some((item) => item.id === subject.id))
    throw new Error("Раздел не найден");
  const subjects = state.settings.customSubjects.map((item) =>
    item.id === subject.id ? subject : item,
  );
  validateSubjects(subjects);
  state.update({ customSubjects: subjects });
}
