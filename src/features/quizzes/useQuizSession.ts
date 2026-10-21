import { useEffect, useRef, useState } from "react";
import { useSubjectNames } from "../../hooks/useSubjectNames";
import { useSettings } from "../../store/useSettings";
import { shuffled } from "../../utils/format";
import {
  createQuestion,
  isAnswerCorrect,
  type ExerciseType,
  type Question,
} from "./engine";
import type { Word } from "../../types";
import type { Answer, QuizMode, AnswerDirection } from "./types";
import { recordReviews } from "../../services/review";
import { reportError } from "../../store/useUI";
import {
  initialLearningProgress,
  learningOrder,
  advanceLearning,
  type LearningProgressMap,
} from "./adaptive";
import { assessmentsFor } from "./assessments";
import { saveTestAttempt } from "./quizRepository";
export interface QuizOptions {
  words: Word[];
  mode: QuizMode;
  deckId?: string;
  title?: string;
}
export function useQuizSession({
  words,
  mode,
  deckId,
  title = "Выбранные материалы",
}: QuizOptions) {
  const [savedResultId, setSavedResultId] = useState<string>();
  const languages = useSubjectNames();
  const { settings } = useSettings();
  const [learningProgress, setLearningProgress] = useState<LearningProgressMap>(
    {},
  );
  const progressRef = useRef<LearningProgressMap>({});
  const sessionWords = useRef(words);
  const mastered = Object.values(learningProgress).filter(
    (item) => item.streak >= item.required,
  ).length;
  const learningTotal = Object.keys(learningProgress).length || words.length;

  const [count, setCount] = useState(
    Math.min(mode === "test" ? 20 : 10, words.length),
  );
  const [types, setTypes] = useState<ExerciseType[]>(["choice"]);
  const [direction, setDirection] = useState<AnswerDirection>("both");
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<Record<number, Answer>>({});
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState(0);
  const [pending, setPending] = useState(false);
  const [finished, setFinished] = useState(false);
  const [preview] = useState(() =>
    words
      .slice(0, 3)
      .map((word) => createQuestion(word, words, "choice", true)),
  );
  const locked = useRef(false);
  const currentResults = useRef<Record<number, Answer>>({});
  const started = useRef(Date.now());
  const alive = useRef(true);
  const transition = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(transition.current);
    };
  }, []);
  const subjects = useSettings((state) => state.settings.customSubjects);
  const isTopic = subjects.some(
    (subject) => subject.id === words[0]?.language && subject.kind === "topic",
  );
  const plannedCount = mode === "learn" ? words.length : count;
  const native = words[0]?.nativeLanguage ?? "ru";
  const nativeName = isTopic
    ? "Определения"
    : native === "ru"
      ? "Русский"
      : (languages[native as keyof typeof languages] ?? native);
  function start(source = words) {
    clearTimeout(transition.current);
    const activeTypes: ExerciseType[] = types.length ? types : ["choice"];
    if (!types.length) setTypes(activeTypes);
    const chosen = (
      mode === "learn" ? learningOrder(source) : shuffled(source)
    ).slice(
      0,
      mode === "learn"
        ? source.length
        : Math.max(1, Math.min(count, source.length)),
    );
    sessionWords.current = source;
    progressRef.current =
      mode === "learn" ? initialLearningProgress(source) : {};
    setLearningProgress(progressRef.current);
    setQuestions(
      chosen.map((word, i) =>
        createQuestion(
          word,
          source,
          activeTypes[i % activeTypes.length],
          direction === "learning" || (direction === "both" && i % 2 === 0),
        ),
      ),
    );
    setSession((value) => value + 1);
    setIndex(0);
    setResults({});
    currentResults.current = {};
    setPending(false);
    locked.current = false;
    setFinished(false);
    setSavedResultId(undefined);
    setSettingsOpen(false);
    started.current = Date.now();
  }
  async function answer(
    questionIndex: number,
    value: string,
    override?: boolean,
    incorrectWordIds?: string[],
  ) {
    if (mode === "test") {
      if (locked.current || pending || settingsOpen) return;
      const next = { ...currentResults.current };
      if (!value.trim()) delete next[questionIndex];
      else
        next[questionIndex] = {
          question: questions[questionIndex],
          answer: value,
          incorrectWordIds,
          correct:
            override ??
            isAnswerCorrect(value, questions[questionIndex], settings),
        };
      currentResults.current = next;
      setResults(next);
      return;
    }
    if (
      locked.current ||
      currentResults.current[questionIndex] ||
      !value.trim() ||
      settingsOpen
    )
      return;
    locked.current = true;
    setPending(true);
    const question = questions[questionIndex];
    const correct = override ?? isAnswerCorrect(value, question, settings);
    const result = { question, answer: value, correct, incorrectWordIds };
    currentResults.current = {
      ...currentResults.current,
      [questionIndex]: result,
    };
    setResults(currentResults.current);
    try {
      const assessed = assessmentsFor(result);
      await recordReviews(assessed, Date.now() - started.current, deckId);
      if (!alive.current) return;
      const nextLearning = advanceLearning(
        progressRef.current,
        questions.slice(questionIndex + 1).map((item) => item.word),
        assessed,
      );
      progressRef.current = nextLearning.progress;
      setLearningProgress(nextLearning.progress);
      const queuedQuestions = new Map(
        questions.slice(questionIndex + 1).map((item) => [item.word.id, item]),
      );
      const following = nextLearning.queue.map(
        (word, offset) =>
          queuedQuestions.get(word.id) ??
          createQuestion(
            word,
            sessionWords.current,
            types[(questionIndex + offset + 1) % types.length] ?? "choice",
            direction === "learning" ||
              (direction === "both" && (questionIndex + offset + 1) % 2 === 0),
          ),
      );
      setQuestions([...questions.slice(0, questionIndex + 1), ...following]);
      transition.current = setTimeout(
        () => {
          locked.current = false;
          setPending(false);
          if (!following.length) {
            setFinished(true);
            return;
          }
          const next = questionIndex + 1;
          setIndex(next);
          started.current = Date.now();
          requestAnimationFrame(() => {
            if (!alive.current) return;
            const element = document.getElementById(`question-${next + 1}`);
            if (matchMedia("(pointer: fine)").matches)
              element
                ?.querySelector<HTMLInputElement>("input")
                ?.focus({ preventScroll: true });
          });
        },
        !correct &&
          (question.type === "typing" || question.type === "listening")
          ? 2600
          : 650,
      );
    } catch (error) {
      if (!alive.current) return;
      delete currentResults.current[questionIndex];
      setResults({ ...currentResults.current });
      locked.current = false;
      setPending(false);
      reportError(error);
    }
  }
  async function checkTest() {
    if (
      locked.current ||
      Object.keys(currentResults.current).length !== questions.length
    )
      return;
    locked.current = true;
    setPending(true);
    try {
      const answers = Object.values(currentResults.current);
      const resultId = await saveTestAttempt(
        answers,
        Date.now() - started.current,
        title,
        deckId,
      );
      if (alive.current) setSavedResultId(resultId);
      if (alive.current) setFinished(true);
    } catch (error) {
      if (alive.current) reportError(error);
    } finally {
      locked.current = false;
      if (alive.current) setPending(false);
    }
  }
  return {
    savedResultId,
    mastered,
    learningTotal,
    count,
    setCount,
    types,
    setTypes,
    direction,
    setDirection,
    settingsOpen,
    setSettingsOpen,
    questions,
    results,
    index,
    session,
    pending,
    finished,
    preview,
    plannedCount,
    isTopic,
    nativeName,
    start,
    answer,
    checkTest,
  };
}
