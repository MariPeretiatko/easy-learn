import { languages } from "../utils/format";
import type { StudySubject } from "../types";
export function validateSubjects(
  value: unknown,
): asserts value is StudySubject[] {
  if (!Array.isArray(value))
    throw new Error("Некорректный список языков и тем");
  const ids = new Set<string>(Object.keys(languages));
  const names = new Set<string>(
    Object.values(languages).map((name) => name.toLocaleLowerCase()),
  );
  for (const subject of value) {
    if (
      !subject ||
      typeof subject !== "object" ||
      typeof subject.id !== "string" ||
      typeof subject.name !== "string" ||
      !subject.name.trim() ||
      subject.name.length > 80 ||
      !["language", "topic"].includes(subject.kind) ||
      !(
        subject.kind === "language"
          ? /^custom-[a-zA-Z0-9-]+$/
          : /^topic-[a-zA-Z0-9-]+$/
      ).test(subject.id) ||
      ids.has(subject.id) ||
      names.has(subject.name.trim().toLocaleLowerCase()) ||
      (subject.speechCode !== undefined &&
        (typeof subject.speechCode !== "string" ||
          !/^[a-zA-Z]{2,8}(-[a-zA-Z0-9]{2,8})*$/.test(subject.speechCode)))
    )
      throw new Error("Некорректный язык или тема");
    ids.add(subject.id);
    names.add(subject.name.trim().toLocaleLowerCase());
  }
}
