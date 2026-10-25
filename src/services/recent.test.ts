import { expect, it } from "vitest";
import type { Collection, RecentItem } from "../types";
import { compareLibraryCollections } from "./recent";
it("sorts modules by actual opening time across level folders", () => {
  const a: Collection = {
    id: "a",
    title: "А",
    kind: "course",
    folderId: "A1",
    description: "",
    deckIds: [],
    createdAt: 1,
    updatedAt: 100,
  };
  const b: Collection = {
    ...a,
    id: "b",
    title: "Б",
    folderId: "B1",
    updatedAt: 2,
  };
  const recent: RecentItem[] = [
    { key: "modules/b", kind: "modules", id: "b", title: "Б", timestamp: 1000 },
  ];
  expect(
    [a, b].sort((x, y) =>
      compareLibraryCollections(x, y, "recent", recent, []),
    ),
  ).toEqual([b, a]);
  expect(
    [b, a].sort((x, y) => compareLibraryCollections(x, y, "title", recent, [])),
  ).toEqual([a, b]);
});
