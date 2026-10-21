import { subjectSpeechCode } from "./subjects";
import { useUI } from "../store/useUI";
const locales: Record<string, string> = {
  de: "de-DE",
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  ru: "ru-RU",
  uk: "uk-UA",
};
export function speak(text: string, language: string, slow = false) {
  if (!("speechSynthesis" in window)) {
    useUI.getState().toast("Браузер не поддерживает озвучивание", true);
    return;
  }
  const code = subjectSpeechCode(language);
  if (!code) {
    useUI
      .getState()
      .toast("Добавьте код языка для озвучки в настройках языка", true);
    return;
  }
  language = code;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = locales[language] ?? language;
  utterance.rate = slow ? 0.65 : 0.9;
  const voice =
    speechSynthesis.getVoices().find((v) => v.lang === utterance.lang) ??
    speechSynthesis.getVoices().find((v) => v.lang.startsWith(language));
  if (voice) utterance.voice = voice;
  utterance.onerror = (e) => {
    if (e.error !== "interrupted" && e.error !== "canceled")
      useUI
        .getState()
        .toast(
          "Не удалось озвучить. Проверьте голосовые пакеты браузера.",
          true,
        );
  };
  speechSynthesis.speak(utterance);
}
