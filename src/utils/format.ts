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
export const uid = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
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
