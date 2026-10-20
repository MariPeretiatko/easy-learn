import type { Language } from "../types";
import { normalize } from "../utils/format";
export interface TranslationResult {
  term: string;
  translation: string | null;
  partOfSpeech?: string;
  provider: string;
}
export interface TranslationService {
  translateWord(
    text: string,
    from: Language,
    to: string,
  ): Promise<TranslationResult>;
  translateText(
    text: string,
    from: Language,
    to: string,
  ): Promise<TranslationResult>;
}
const dictionary: Record<string, Record<string, string>> = {
  de: {
    Hund: "собака",
    Katze: "кошка",
    arbeiten: "работать",
    lernen: "учить, учиться",
    trotzdem: "несмотря на это",
    entdecken: "открывать, узнавать",
    Reise: "путешествие",
    Buch: "книга",
    Sprache: "язык",
    Freund: "друг",
    Zeit: "время",
    Welt: "мир",
    heute: "сегодня",
    morgen: "завтра",
    klein: "маленький",
    Schritt: "шаг",
    gehen: "идти",
    lesen: "читать",
    sprechen: "говорить",
    hören: "слушать",
    schön: "красивый",
    Tag: "день",
    Wort: "слово",
    neu: "новый",
    Stadt: "город",
    Kaffee: "кофе",
    Wasser: "вода",
    Haus: "дом",
    Musik: "музыка",
  },
  en: {
    dog: "собака",
    cat: "кошка",
    learn: "учиться",
    read: "читать",
    book: "книга",
    world: "мир",
    hello: "привет",
    journey: "путешествие",
    discover: "открывать",
  },
  fr: { bonjour: "здравствуйте", livre: "книга", chat: "кот" },
  es: { hola: "привет", libro: "книга", gato: "кот" },
};
const lemmas: Record<string, Record<string, string>> = {
  de: {
    hunde: "Hund",
    hunden: "Hund",
    katzen: "Katze",
    bücher: "Buch",
    büchern: "Buch",
    wörter: "Wort",
    wörtern: "Wort",
    freunde: "Freund",
    freunden: "Freund",
    sprachen: "Sprache",
    lernt: "lernen",
    lerne: "lernen",
    gelernt: "lernen",
    ging: "gehen",
    gegangen: "gehen",
    geht: "gehen",
    liest: "lesen",
    gelesen: "lesen",
    tage: "Tag",
    tagen: "Tag",
    schritte: "Schritt",
    schritten: "Schritt",
    städte: "Stadt",
  },
  en: {
    dogs: "dog",
    cats: "cat",
    books: "book",
    children: "child",
    went: "go",
    learning: "learn",
    learned: "learn",
    reads: "read",
  },
};
export function lemma(text: string, language: Language) {
  const cleaned = normalize(text);
  return lemmas[language]?.[cleaned] ?? cleaned;
}
class BasicTranslationService implements TranslationService {
  async translateWord(
    text: string,
    from: Language,
    to: string,
  ): Promise<TranslationResult> {
    const term = lemma(text, from);
    const match = Object.entries(dictionary[from] ?? {}).find(
      ([key]) => normalize(key) === normalize(term),
    );
    return {
      term: match?.[0] ?? term,
      translation: to === "ru" ? (match?.[1] ?? null) : null,
      provider: "Локальный мини-словарь",
    };
  }
  async translateText(text: string, from: Language, to: string) {
    return this.translateWord(text, from, to);
  }
}
export const translationService: TranslationService =
  new BasicTranslationService();
