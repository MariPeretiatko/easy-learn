import { db } from "../db/database";
import { newWord, wordIdentity } from "./wordModel";
import { WordRepository } from "./repositories";
import type { Language } from "../types";
import type { CsvWord } from "./csv";
/** Import the whole preview atomically, including membership for reused cards. */
export async function importVocabulary(
  rows: CsvWord[],
  language: Language,
  nativeLanguage: string,
  deck?: string,
) {
  let added = 0,
    skipped = 0;
  await db.transaction(
    "rw",
    [db.words, db.decks, db.statistics, ...(db.owner ? [db.activity] : [])],
    async () => {
      const existing = new Set(
        (await db.words.where("language").equals(language).toArray()).map(
          wordIdentity,
        ),
      );
      for (const row of rows) {
        const identity = wordIdentity({
          ...row,
          language: language,
          nativeLanguage: nativeLanguage,
        });
        if (existing.has(identity)) {
          skipped++;
          if (deck)
            await WordRepository.save(
              newWord({
                ...row,
                language: language,
                nativeLanguage: nativeLanguage,
              }),
              deck,
            );
          continue;
        }
        await WordRepository.save(
          newWord({
            ...row,
            language: language,
            nativeLanguage: nativeLanguage,
          }),
          deck || undefined,
        );
        existing.add(identity);
        added++;
      }
    },
  );
  return { added, skipped };
}
