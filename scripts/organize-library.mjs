import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const original = JSON.parse(
  await readFile(
    new URL("../src/data/deutsch-a1-b1.json", import.meta.url),
    "utf8",
  ),
);
const themes = [
  [
    "personal",
    "Знакомство и отношения",
    [
      [
        "Знакомство и личные данные",
        ["Знакомство и общение", "Личные данные и люди"],
      ],
      ["Семья и отношения", ["Семья и отношения"]],
      ["Общение и этикет", ["Общение, этикет и чувства"]],
    ],
  ],
  [
    "home",
    "Дом и быт",
    [
      [
        "Дом и квартира",
        [
          "Дом, квартира и аренда",
          "Дом, уборка и быт",
          "Дом, ремонт и бытовые действия",
        ],
      ],
      [
        "Мебель и техника",
        ["Мебель, материалы и техника", "Техника и технологии"],
      ],
    ],
  ],
  [
    "food",
    "Еда и покупки",
    [
      [
        "Продукты и напитки",
        ["Продукты, фрукты и овощи", "Напитки и готовые блюда"],
      ],
      ["Кафе и ресторан", ["Ресторан, кухня и домашние дела"]],
      [
        "Магазины и покупки",
        ["Магазины, покупки и упаковка", "Покупки, интернет-заказы и возвраты"],
      ],
      [
        "Одежда и уход за вещами",
        ["Одежда, цвета и стирка", "Одежда, покупки и товары"],
      ],
    ],
  ],
  [
    "work",
    "Учёба и работа",
    [
      [
        "Учёба и образование",
        [
          "Учёба и работа с текстом",
          "Учёба, образование и экзамены",
          "Высшее образование, наука и способности",
        ],
      ],
      [
        "Профессии и карьера",
        [
          "Профессии и рабочий день",
          "Поиск работы и профессии",
          "Профессии, компании и трудовой договор",
          "Работа, офис и карьера",
        ],
      ],
      ["Офис и рабочие процессы", ["Офис, производство и рабочие процессы"]],
    ],
  ],
  [
    "leisure",
    "Время и досуг",
    [
      ["Время и распорядок дня", ["Время, календарь и частотность"]],
      [
        "Спорт и увлечения",
        ["Спорт и увлечения", "Спорт, кино, телевидение и досуг"],
      ],
      [
        "Культура и медиа",
        ["Культура, музыка и досуг", "Искусство, литература и медиа"],
      ],
      ["Праздники и традиции", ["Праздники, обычаи и религия"]],
    ],
  ],
  [
    "travel",
    "Город и путешествия",
    [
      [
        "Город и дорога",
        [
          "Город, транспорт и дорога",
          "Город, экскурсии и культура",
          "Город, архитектура и достопримечательности",
        ],
      ],
      [
        "Поездки и путешествия",
        [
          "Поездки, билеты и аэропорт",
          "Отдых, жильё в поездке и развлечения",
          "Путешествия, гостиницы и транспорт",
        ],
      ],
      [
        "Автомобиль и безопасность",
        [
          "Аварии, автомобиль и первая помощь",
          "Автомобиль, вождение и страхование",
        ],
      ],
      [
        "Страны и жизнь за границей",
        ["Страны, языки и континенты", "Переезд, миграция и жизнь за границей"],
      ],
    ],
  ],
  [
    "health",
    "Здоровье и чувства",
    [
      [
        "Тело и здоровье",
        [
          "Тело и органы",
          "Здоровье, врачи и лекарства",
          "Питание, здоровье и уход",
        ],
      ],
      [
        "Чувства и отношения",
        [
          "Чувства, здоровье и состояния",
          "Самочувствие, эмоции и отношения",
          "Мысли, эмоции и человеческие качества",
        ],
      ],
    ],
  ],
  [
    "nature",
    "Природа и экология",
    [
      [
        "Природа и погода",
        ["Отдых, природа и животные", "Погода, природа и география"],
      ],
      [
        "Экология и животные",
        [
          "Животные, сельское хозяйство и экология",
          "Экология, энергия и природные явления",
        ],
      ],
    ],
  ],
  [
    "society",
    "Деньги и общество",
    [
      ["Деньги и платежи", ["Деньги, банк и платежи", "Числа и деньги"]],
      [
        "Документы и обращения",
        [
          "Общество, документы и полиция",
          "Документы, права и официальные процедуры",
          "Почта, доставка и обращения",
        ],
      ],
      [
        "Общество и политика",
        [
          "Политика, право и выборы",
          "История, религия и общество",
          "Общество, история и конфликты",
          "Волонтёрство, сотрудничество и повседневная жизнь",
        ],
      ],
    ],
  ],
  [
    "actions",
    "Действия и качества",
    [
      [
        "Глаголы и действия",
        [
          "Действия и повседневные глаголы",
          "Действия и глаголы с предлогами",
          "Дополнительные действия и полезные связки",
        ],
      ],
      [
        "Качества и оценки",
        [
          "Качества, оценки и противоположности",
          "Качества, состояния и оценки",
          "Качества, оценки и состояния",
        ],
      ],
    ],
  ],
  [
    "speech",
    "Язык и выражения",
    [
      [
        "Слова-связки и выражения",
        [
          "Местоимения, вопросы и служебные слова",
          "Связки, наречия и полезные выражения",
          "Связки, наречия, числа и устойчивые выражения",
        ],
      ],
      [
        "Язык и работа с информацией",
        ["Язык, информация и рассуждение", "Язык, тексты и структура речи"],
      ],
    ],
  ],
];
const lookup = new Map(
  themes.flatMap(([key, , groups]) =>
    groups.flatMap(([title, names]) =>
      names.map((name) => [name, { key, title }]),
    ),
  ),
);
const stable = (...parts) =>
  "deutsch-v2-" +
  createHash("sha256").update(parts.join("\0")).digest("hex").slice(0, 24);
const result = {
  id: "deutsch-a1-a2-b1-ru-v2",
  legacyCollectionIds: original.folders.flatMap((folder) => [
    folder.id,
    ...folder.modules.map((module) => module.id),
  ]),
  language: "de",
  nativeLanguage: "ru",
  folders: [],
};
const summary = [];
for (const sourceModule of original.folders[0].modules) {
  const level = sourceModule.title.split(" ")[0];
  const groups = new Map();
  for (const deck of sourceModule.decks) {
    const base = deck.title.replace(/ — \d+$/, "");
    const topic = lookup.get(base);
    if (!topic) throw new Error("Unassigned theme: " + base);
    if (!groups.has(topic.key)) groups.set(topic.key, new Map());
    const subtopics = groups.get(topic.key);
    if (!subtopics.has(topic.title)) subtopics.set(topic.title, []);
    subtopics.get(topic.title).push(
      ...deck.cards.map((card, index) => ({
        ...card,
        sourceDeckId: deck.id,
        sourceCardIndex: index,
      })),
    );
  }
  // A2 has too little introductory vocabulary for a separate chapter.
  for (const [key, subtopics] of [...groups]) {
    if ([...subtopics.values()].flat().length >= 20) continue;
    const target =
      key === "personal" ? "speech" : key === "nature" ? "leisure" : "society";
    if (target === key || !groups.has(target))
      throw new Error("No related chapter for " + key);
    if (key === "personal")
      groups
        .get(target)
        .set("Знакомство и общение", [...subtopics.values()].flat());
    else
      for (const [title, cards] of subtopics)
        groups.get(target).set(title, cards);
    groups.delete(key);
  }
  const folder = { id: stable(level), title: level, modules: [] };
  for (const [key, name] of themes) {
    const subtopics = groups.get(key);
    if (!subtopics) continue;
    const moduleTitle =
      level === "A2" && key === "speech" ? "Язык и общение" : name;
    const module = { id: stable(level, key), title: moduleTitle, decks: [] };
    const combined = new Set();
    const small = [...subtopics].filter(([, cards]) => cards.length < 10);
    for (const [title, cards] of small) {
      if (!subtopics.has(title)) continue;
      const other = [...subtopics]
        .filter(([name]) => name !== title)
        .sort((a, b) => b[1].length - a[1].length)[0];
      if (!other) throw new Error("Isolated small deck " + title);
      subtopics.delete(title);
      subtopics.get(other[0]).push(...cards);
      combined.add(other[0]);
    }
    for (const [originalTitle, cards] of subtopics) {
      const title = combined.has(originalTitle) ? moduleTitle : originalTitle;
      // Balanced parts avoid tiny remainders (e.g. 46 becomes 23 + 23).
      const partCount = Math.ceil(cards.length / 40);
      const size = Math.floor(cards.length / partCount);
      let offset = 0;
      for (let part = 0; part < partCount; part++) {
        const length = size + (part < cards.length % partCount ? 1 : 0);
        module.decks.push({
          id: stable(level, key, title, String(part)),
          title: partCount > 1 ? `${title} — ${part + 1}` : title,
          cards: cards.slice(offset, offset + length),
        });
        offset += length;
      }
    }
    // Every chapter contains several decks, each with at least ten cards.
    if (module.decks.length === 1) {
      const single = module.decks.pop();
      const mid = Math.ceil(single.cards.length / 2);
      module.decks.push(
        ...[single.cards.slice(0, mid), single.cards.slice(mid)].map(
          (cards, i) => ({
            id: stable(level, key, "split", String(i)),
            title: `${single.title} — ${i + 1}`,
            cards,
          }),
        ),
      );
    }
    if (module.decks.some((deck) => deck.cards.length < 10))
      throw new Error("Small deck in " + moduleTitle);
    folder.modules.push(module);
  }
  result.folders.push(folder);
  summary.push({
    level,
    modules: folder.modules.length,
    decks: folder.modules.reduce((n, m) => n + m.decks.length, 0),
    cards: folder.modules
      .flatMap((m) => m.decks)
      .reduce((n, d) => n + d.cards.length, 0),
  });
}
const originalCount = original.folders[0].modules
  .flatMap((m) => m.decks)
  .flatMap((d) => d.cards).length;
const all = result.folders
  .flatMap((f) => f.modules)
  .flatMap((m) => m.decks)
  .flatMap((d) => d.cards);
if (
  all.length !== originalCount ||
  new Set(all.map((c) => `${c.sourceDeckId}/${c.sourceCardIndex}`)).size !==
    originalCount
)
  throw new Error("Lost or duplicated cards");
await writeFile(
  new URL("../src/data/deutsch-organized.json", import.meta.url),
  JSON.stringify(result) + "\n",
);
console.log(summary);
