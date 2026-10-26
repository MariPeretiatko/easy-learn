import { db } from "../db/database";
import { newWord, wordIdentity } from "./wordModel";
import { trackActivity } from "./repositories";
import type { Language, Word } from "../types";
import type { CsvWord } from "./csv";
/** Validate and commit the complete import with one vocabulary read and bulk writes. */
export async function importVocabulary(
  rows: CsvWord[],
  language: Language,
  nativeLanguage: string,
  deckId?: string,
) {
  return db.transaction(
    "rw",
    [db.words, db.decks, db.statistics, ...(db.owner ? [db.activity] : [])],
    async () => {
      const deck = deckId ? await db.decks.get(deckId) : undefined;
      if (deckId && (!deck || deck.language !== language))
        throw new Error("Выберите колоду на языке слова");
      const existing = new Map<string, Word>();
      for (const word of await db.words
        .where("[language+nativeLanguage]")
        .equals([language, nativeLanguage])
        .toArray())
        if (!existing.has(wordIdentity(word)))
          existing.set(wordIdentity(word), word);
      const added: Word[] = [];
      const members = new Set(deck?.wordIds ?? []);
      let skipped = 0;
      for (const row of rows) {
        if (!row.term.trim() || !row.translation.trim())
          throw new Error("Введите слово и перевод");
        const word = newWord({
          ...row,
          term: row.term.trim(),
          translation: row.translation.trim(),
          language,
          nativeLanguage,
        });
        const identity = wordIdentity(word);
        const duplicate = existing.get(identity);
        if (duplicate) skipped++;
        else {
          added.push(word);
          existing.set(identity, word);
        }
        members.add(duplicate?.id ?? word.id);
      }
      if (added.length) {
        await db.words.bulkAdd(added);
        await trackActivity({ wordsAdded: added.length });
      }
      if (deck && members.size !== deck.wordIds.length)
        await db.decks.update(deck.id, {
          wordIds: [...members],
          updatedAt: Date.now(),
        });
      return { added: added.length, skipped };
    },
  );
}
