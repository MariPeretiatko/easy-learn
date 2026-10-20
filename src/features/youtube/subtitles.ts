import type { Subtitle } from "../../types";
export function youtubeId(input: string) {
  try {
    const url = new URL(input.trim());
    if (!["https:", "http:"].includes(url.protocol)) return null;
    let id = "";
    if (url.hostname === "youtu.be") id = url.pathname.slice(1).split("/")[0];
    else if (
      [
        "youtube.com",
        "www.youtube.com",
        "m.youtube.com",
        "www.youtube-nocookie.com",
      ].includes(url.hostname)
    ) {
      const parts = url.pathname.split("/");
      id =
        url.searchParams.get("v") ??
        (["embed", "shorts", "live"].includes(parts[1]) ? parts[2] : "");
    }
    return /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
function seconds(input: string) {
  const parts = input.replace(",", ".").split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return NaN;
  return parts.reduce((sum, p) => sum * 60 + p, 0);
}
export function parseSubtitles(input: string): Subtitle[] {
  const text = input
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .trim();
  if (!text) return [];
  if (text.startsWith("[")) {
    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || !parsed.every(isSubtitle))
      throw new Error(
        "JSON должен содержать массив {start, end, text, translation?}",
      );
    return [...parsed].sort((a, b) => a.start - b.start);
  }
  const subtitles: Subtitle[] = [];
  for (const block of text.split(/\n\s*\n/)) {
    const lines = block.split("\n");
    const index = lines.findIndex((line) => line.includes("-->"));
    if (index < 0) continue;
    const [from, to] = lines[index]
      .split("-->")
      .map((x) => x.trim().split(/\s+/)[0]);
    const start = seconds(from),
      end = seconds(to);
    const caption = lines
      .slice(index + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end <= start ||
      !caption
    )
      throw new Error("Некорректные временные метки субтитров");
    subtitles.push({ start, end, text: caption });
  }
  if (!subtitles.length)
    throw new Error("Не найдены субтитры. Используйте SRT, VTT или JSON.");
  return subtitles.sort((a, b) => a.start - b.start);
}
export function isSubtitle(value: unknown): value is Subtitle {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.start === "number" &&
    Number.isFinite(v.start) &&
    v.start >= 0 &&
    typeof v.end === "number" &&
    Number.isFinite(v.end) &&
    v.end > v.start &&
    typeof v.text === "string" &&
    !!v.text.trim() &&
    (v.translation === undefined || typeof v.translation === "string")
  );
}
