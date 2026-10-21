import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const [source, target] = process.argv.slice(2);
if (!source || !target)
  throw new Error(
    "Usage: node scripts/prepare-library.mjs source.txt target.json",
  );
const text = await readFile(source, "utf8");
const id = (...parts) =>
  "deutsch-" +
  createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
const bundle = {
  id: "deutsch-a1-a2-b1-ru-v1",
  language: "de",
  nativeLanguage: "ru",
  folders: [],
};
let folder, module, deck;
for (const [index, raw] of text.split(/\r?\n/).entries()) {
  const line = raw.trim();
  if (!line) continue;
  const header = /^(Язык|Перевод на|Папка|Модуль|Колода):\s*(.+)$/.exec(line);
  if (header) {
    const [, type, title] = header;
    if (type === "Язык" && title !== "немецкий")
      throw new Error("Expected German");
    if (type === "Перевод на" && title !== "русский")
      throw new Error("Expected Russian");
    if (type === "Папка") {
      folder = { id: id("folder", title), title, modules: [] };
      bundle.folders.push(folder);
      module = deck = undefined;
    }
    if (type === "Модуль") {
      if (!folder) throw new Error(`Line ${index + 1}: module without folder`);
      module = { id: id(folder.id, title), title, decks: [] };
      folder.modules.push(module);
      deck = undefined;
    }
    if (type === "Колода") {
      if (!module) throw new Error(`Line ${index + 1}: deck without module`);
      deck = { id: id(module.id, title), title, cards: [] };
      module.decks.push(deck);
    }
    continue;
  }
  const cells = line.split("|").map((cell) => cell.trim());
  if (!deck || cells.length < 2 || cells.length > 3 || !cells[0] || !cells[1])
    throw new Error(`Invalid card at line ${index + 1}`);
  deck.cards.push({
    term: cells[0],
    translation: cells[1],
    ...(cells[2] ? { example: cells[2] } : {}),
  });
}
await writeFile(target, JSON.stringify(bundle, null, 2) + "\n");
console.log(
  bundle.folders
    .flatMap((folder) => folder.modules)
    .map((module) => ({
      module: module.title,
      decks: module.decks.length,
      cards: module.decks.reduce((n, deck) => n + deck.cards.length, 0),
    })),
);
