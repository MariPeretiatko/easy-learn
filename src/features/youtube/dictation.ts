import { normalize } from "../../utils/format";
export interface DictationToken {
  text: string;
  status: "correct" | "missing" | "incorrect";
}
export function compareDictation(original: string, input: string) {
  const expected = original.trim().split(/\s+/).filter(Boolean);
  const actual = input.trim().split(/\s+/).filter(Boolean);
  const a = expected.map(normalize),
    b = actual.map(normalize);
  const dp = Array.from({ length: a.length + 1 }, () =>
    Array<number>(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const tokens: DictationToken[] = [];
  let i = a.length,
    j = b.length;
  while (i || j) {
    if (i && j && a[i - 1] === b[j - 1]) {
      tokens.unshift({ text: expected[--i], status: "correct" });
      j--;
    } else if (j && (!i || dp[i][j - 1] >= dp[i - 1][j]))
      tokens.unshift({ text: actual[--j], status: "incorrect" });
    else tokens.unshift({ text: expected[--i], status: "missing" });
  }
  const correct = tokens.filter((t) => t.status === "correct").length;
  return {
    tokens,
    accuracy: Math.round(
      (correct / Math.max(expected.length, actual.length, 1)) * 100,
    ),
  };
}
