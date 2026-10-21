export type Language =
  "de" | "en" | "fr" | "es" | `custom-${string}` | `topic-${string}`;
export interface StudySubject {
  id: Language;
  name: string;
  kind: "language" | "topic";
  speechCode?: string;
}
export type WordStatus = "new" | "learning" | "review" | "mastered" | "ignored";
export type Rating = "again" | "hard" | "good" | "easy";
export type EntryType =
  "word" | "phrase" | "idiom" | "collocation" | "phrasal verb" | "sentence";
export interface Word {
  id: string;
  term: string;
  image?: string;
  termImage?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
  translation: string;
  acceptedTerms?: string[];
  acceptedTranslations?: string[];
  language: Language;
  nativeLanguage: string;
  definition: string;
  example: string;
  pronunciation: string;
  ipa: string;
  partOfSpeech: string;
  gender: string;
  article: string;
  plural: string;
  verbForms: string;
  synonyms: string;
  antonyms: string;
  notes: string;
  tags: string[];
  status: WordStatus;
  difficulty: number;
  interval: number;
  createdAt: number;
  updatedAt: number;
  lastReviewedAt?: number;
  nextReviewAt: number;
  reviewCount: number;
  correctCount: number;
  incorrectCount: number;
  sourceId?: string;
  sourceType?: "text" | "video" | "manual";
  sourceTitle?: string;
  sourceTimestamp?: number;
  favorite: boolean;
  type: EntryType;
  separable: boolean;
  reflexive: boolean;
  preposition: string;
  grammaticalCase: string;
}
export interface Deck {
  id: string;
  title: string;
  description: string;
  language: Language;
  tags: string[];
  wordIds: string[];
  createdAt: number;
  updatedAt: number;
  favorite: boolean;
  lastStudiedAt?: number;
}
export interface TextDocument {
  id: string;
  title: string;
  content: string;
  language: Language;
  source: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  readingProgress: number;
  favorite: boolean;
}
export interface Subtitle {
  start: number;
  end: number;
  text: string;
  translation?: string;
}
export interface Video {
  id: string;
  youtubeId: string;
  url: string;
  title: string;
  language: Language;
  subtitles: Subtitle[];
  tags: string[];
  lastPosition: number;
  createdAt: number;
  favorite: boolean;
}
export interface ReviewHistory {
  id: string;
  wordId: string;
  result: Rating;
  timestamp: number;
  responseTime: number;
}
export interface DailyStatistics {
  date: string;
  wordsAdded: number;
  wordsReviewed: number;
  correctAnswers: number;
  incorrectAnswers: number;
  studyMinutes: number;
  readingMinutes: number;
  listeningMinutes: number;
}
export interface RecentItem {
  key: string;
  id: string;
  kind: "decks" | "modules" | "vocabulary" | "reader" | "videos";
  title: string;
  timestamp: number;
}
export interface Settings {
  customSubjects: StudySubject[];
  strictAnswerCase: boolean;
  strictAnswerArticles: boolean;
  profileName?: string;
  profileAvatar?: string;
  learningLanguage: Language;
  nativeLanguage: string;
  direction: "forward" | "reverse";
  autoPronounce: boolean;
  theme: "light" | "dark" | "system";
  fontSize: number;
  lineHeight: number;
  textWidth: number;
  readerDark: boolean;
  longestStreak: number;
  matchBest: Record<string, number>;
}

export interface SetCard {
  id: string;
  wordId?: string;
  term: string;
  definition: string;
  acceptedTerms?: string[];
  acceptedTranslations?: string[];
  image?: string;
  termImage?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  highlight?: boolean;
}
export interface SetDraft {
  id: string;
  sourceDeckId?: string;
  title: string;
  description: string;
  language: Language;
  nativeLanguage: string;
  cards: SetCard[];
  createdAt: number;
  updatedAt: number;
}
export interface Collection {
  id: string;
  folderId?: string;
  kind: "folder" | "class" | "course";
  language?: Language;
  title: string;
  description: string;
  deckIds: string[];
  createdAt: number;
  updatedAt: number;
}
export interface Solution {
  id: string;
  title: string;
  question: string;
  answer: string;
  createdAt: number;
  updatedAt: number;
}
export interface TestResult {
  id: string;
  deckId?: string;
  title: string;
  timestamp: number;
  answers: {
    term: string;
    expected: string;
    given: string;
    correct: boolean;
  }[];
}
