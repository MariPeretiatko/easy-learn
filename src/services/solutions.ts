import { db } from "../db/database";
import type { Solution } from "../types";
export const SolutionRepository = {
  save: (solution: Solution) =>
    db.solutions.put({ ...solution, updatedAt: Date.now() }),
  delete: (id: string) => db.solutions.delete(id),
};
