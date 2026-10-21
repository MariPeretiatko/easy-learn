import type { Word } from "../types";
import { uid } from "../utils/format";
export const newWord = (draft: Partial<Word>): Word => ({
  id: uid(),
  term: "",
  translation: "",
  language: "de",
  nativeLanguage: "ru",
  definition: "",
  example: "",
  pronunciation: "",
  ipa: "",
  partOfSpeech: "",
  gender: "",
  article: "",
  plural: "",
  verbForms: "",
  synonyms: "",
  antonyms: "",
  notes: "",
  tags: [],
  status: "new",
  difficulty: 2,
  interval: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  nextReviewAt: Date.now(),
  reviewCount: 0,
  correctCount: 0,
  incorrectCount: 0,
  favorite: false,
  type: "word",
  separable: false,
  reflexive: false,
  preposition: "",
  grammaticalCase: "",
  ...draft,
});
export const wordIdentity = (
  word: Pick<Word, "language" | "nativeLanguage" | "term" | "translation">,
) =>
  JSON.stringify([
    word.language,
    word.nativeLanguage,
    word.term.normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/g, " "),
    word.translation
      .normalize("NFC")
      .trim()
      .toLocaleLowerCase()
      .replace(/\s+/g, " "),
  ]);
