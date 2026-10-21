import { db } from "../db/database";
import type { SetDraft } from "../types";
import { uid } from "../utils/format";
import { newWord, wordIdentity } from "./wordModel";
import { trackActivity, matchingWord } from "./repositories";
export async function publishDraft(draft: SetDraft) {
  if (!draft.title.trim()) throw new Error("Укажите название колоды");
  const cards = draft.cards.filter(
    (card) => card.term.trim() || card.definition.trim(),
  );
  if (!cards.length) throw new Error("Добавьте хотя бы одну карточку");
  const id = draft.sourceDeckId ?? draft.id;
  await db.transaction(
    "rw",
    db.words,
    db.decks,
    db.statistics,
    db.drafts,
    async () => {
      const existing = await db.decks.get(id);
      if (existing && existing.language !== draft.language)
        throw new Error(
          "Изменение языка колоды недоступно: создайте новую колоду на нужном языке.",
        );
      const wordIds: string[] = [];
      let added = 0;
      for (const card of cards) {
        if (!card.term.trim() || !card.definition.trim())
          throw new Error("Заполните термин и определение в каждой карточке");
        const previous = card.wordId
          ? await db.words.get(card.wordId)
          : undefined;
        if (card.wordId && !previous)
          throw new Error("Термин был удалён. Откройте колоду заново.");
        const identity = {
          term: card.term.trim(),
          translation: card.definition.trim(),
          language: draft.language,
          nativeLanguage: draft.nativeLanguage,
        };
        const duplicate = await matchingWord(identity, previous?.id);
        if (
          previous &&
          duplicate &&
          wordIdentity(previous) !== wordIdentity(identity)
        )
          throw new Error(
            "Такая карточка уже есть в словаре. Удалите повтор и добавьте существующую карточку.",
          );
        if (!previous && duplicate) {
          if (!wordIds.includes(duplicate.id)) wordIds.push(duplicate.id);
          continue;
        }
        if (previous && previous.language !== draft.language)
          throw new Error("Язык карточки должен совпадать с языком колоды");
        const word = newWord({
          ...previous,
          term: card.term.trim(),
          translation: card.definition.trim(),
          language: draft.language,
          nativeLanguage: draft.nativeLanguage,
          acceptedTerms: card.acceptedTerms
            ?.map((value) => value.trim())
            .filter(Boolean),
          acceptedTranslations: card.acceptedTranslations
            ?.map((value) => value.trim())
            .filter(Boolean),
          image: card.image,
          termImage: card.termImage,
          bold: card.bold,
          italic: card.italic,
          underline: card.underline,
          highlight: card.highlight,
          ...(!previous ? { sourceId: id, sourceType: "manual" as const } : {}),
          updatedAt: Date.now(),
        });
        await db.words.put(word);
        if (!previous) added++;
        if (!wordIds.includes(word.id)) wordIds.push(word.id);
      }
      await db.decks.put({
        ...(existing ?? {
          id,
          tags: [],
          favorite: false,
          createdAt: draft.createdAt,
        }),
        title: draft.title.trim(),
        description: draft.description,
        language: draft.language,
        wordIds,
        updatedAt: Date.now(),
      });
      if (added) await trackActivity({ wordsAdded: added });
      await db.drafts.delete(draft.id);
    },
  );
  return id;
}
export async function editSetDraft(deckId: string) {
  const previous = await db.drafts.where("sourceDeckId").equals(deckId).first();
  if (previous) return previous.id;
  const deck = await db.decks.get(deckId);
  if (!deck) throw new Error("Колода не найдена");
  const words = await db.words.bulkGet(deck.wordIds);
  const draft: SetDraft = {
    id: uid(),
    sourceDeckId: deck.id,
    title: deck.title,
    description: deck.description,
    language: deck.language,
    nativeLanguage: words.find((word) => word)?.nativeLanguage ?? "ru",
    cards: words.flatMap((word) =>
      word
        ? [
            {
              id: uid(),
              wordId: word.id,
              term: word.term,
              definition: word.translation,
              acceptedTerms: word.acceptedTerms,
              acceptedTranslations: word.acceptedTranslations,
              image: word.image,
              termImage: word.termImage,
              bold: word.bold,
              italic: word.italic,
              underline: word.underline,
              highlight: word.highlight,
            },
          ]
        : [],
    ),
    createdAt: deck.createdAt,
    updatedAt: Date.now(),
  };
  await db.drafts.put(draft);
  return draft.id;
}
