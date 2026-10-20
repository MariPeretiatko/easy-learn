import type { Language, WordStatus } from "../types";
export const languages: Record<Language, string> = {
  de: "Немецкий",
  en: "Английский",
  fr: "Французский",
  es: "Испанский",
};
export const statusNames: Record<WordStatus, string> = {
  new: "Новое",
  learning: "Изучаю",
  review: "Повторение",
  mastered: "Знаю",
  ignored: "Пропущено",
};
export const dateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const shortDate = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
export const normalize = (text: string) =>
  text
    .normalize("NFC")
    .toLocaleLowerCase()
    .trim()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/\s+/g, " ");
export const uid = () => crypto.randomUUID();
export const timeLabel = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
export const shuffled = <T>(values: T[]) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
