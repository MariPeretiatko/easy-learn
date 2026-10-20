import { db } from "../db/database";
import { newWord } from "./repositories";
export async function loadDemo() {
  await db.transaction("rw", db.words, db.decks, db.texts, async () => {
    const entries = [
      [
        "Hund",
        "собака",
        "Der Hund spielt im Garten.",
        "существительное",
        "der",
        "Hunde",
      ],
      [
        "Katze",
        "кошка",
        "Die Katze schläft auf dem Sofa.",
        "существительное",
        "die",
        "Katzen",
      ],
      [
        "arbeiten",
        "работать",
        "Wir arbeiten heute zusammen.",
        "глагол",
        "",
        "",
      ],
      [
        "lernen",
        "учить, учиться",
        "Ich möchte jeden Tag etwas lernen.",
        "глагол",
        "",
        "",
      ],
      [
        "trotzdem",
        "несмотря на это",
        "Es regnet. Trotzdem gehen wir spazieren.",
        "наречие",
        "",
        "",
      ],
      [
        "entdecken",
        "открывать, узнавать",
        "Wir entdecken eine neue Stadt.",
        "глагол",
        "",
        "",
      ],
      [
        "Reise",
        "путешествие",
        "Die Reise beginnt mit einem kleinen Schritt.",
        "существительное",
        "die",
        "Reisen",
      ],
      [
        "Buch",
        "книга",
        "Dieses Buch ist sehr interessant.",
        "существительное",
        "das",
        "Bücher",
      ],
      [
        "Sprache",
        "язык",
        "Eine neue Sprache öffnet Türen.",
        "существительное",
        "die",
        "Sprachen",
      ],
      [
        "Freund",
        "друг",
        "Mein Freund spricht Deutsch.",
        "существительное",
        "der",
        "Freunde",
      ],
      [
        "Zeit",
        "время",
        "Heute habe ich Zeit für ein gutes Buch.",
        "существительное",
        "die",
        "Zeiten",
      ],
      [
        "Welt",
        "мир",
        "Ich möchte die Welt entdecken.",
        "существительное",
        "die",
        "Welten",
      ],
    ];
    const ids: string[] = [];
    for (const [
      term,
      translation,
      example,
      partOfSpeech,
      article,
      plural,
    ] of entries) {
      const existing = await db.words
        .where("language")
        .equals("de")
        .filter((w) => w.term.toLowerCase() === term.toLowerCase())
        .first();
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const id = `demo-word-${term.toLowerCase()}`;
      ids.push(id);
      await db.words.add(
        newWord({
          id,
          term,
          translation,
          example,
          partOfSpeech,
          article,
          plural,
          tags: ["повседневное"],
          language: "de",
        }),
      );
    }
    if (!(await db.decks.get("demo-deck")))
      await db.decks.add({
        id: "demo-deck",
        title: "Немецкий на каждый день",
        description:
          "Маленькая коллекция для больших открытий. Знакомьтесь со словами в контексте.",
        language: "de",
        tags: ["A1", "повседневное"],
        wordIds: ids,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        favorite: false,
      });
    if (!(await db.texts.get("demo-text")))
      await db.texts.add({
        id: "demo-text",
        title: "Ein kleiner Schritt",
        content:
          "Jeden Morgen nehme ich mir Zeit für eine neue Sprache. Ich lese ein Buch, höre Musik und lerne neue Wörter. Manchmal ist es nicht einfach. Trotzdem mache ich weiter.\n\nHeute gehe ich mit einem Freund durch die Stadt. Wir entdecken ein kleines Café. Vor der Tür sitzt ein Hund. Eine Katze schaut aus dem Fenster. Wir trinken Kaffee und sprechen über unsere nächste Reise.\n\nDie Welt ist groß und voller Geschichten. Ich möchte diese Geschichten verstehen. Jeden Tag lerne ich ein bisschen mehr. Ein kleiner Schritt ist auch ein Schritt.",
        language: "de",
        source: "Оригинальный учебный текст Easy Learn · A1–A2",
        tags: ["A1", "повседневное"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        readingProgress: 0,
        favorite: false,
      });
  });
}
export async function removeDemo() {
  await db.transaction(
    "rw",
    db.words,
    db.decks,
    db.texts,
    db.reviews,
    db.recent,
    async () => {
      const ids = (
        await db.words.filter((w) => w.id.startsWith("demo-")).toArray()
      ).map((w) => w.id);
      await db.words.bulkDelete(ids);
      await db.decks.delete("demo-deck");
      await db.texts.delete("demo-text");
      await db.decks.toCollection().modify((d) => {
        d.wordIds = d.wordIds.filter((id) => !ids.includes(id));
      });
      await db.reviews.where("wordId").anyOf(ids).delete();
      await db.recent.filter((r) => r.id.startsWith("demo-")).delete();
    },
  );
}
