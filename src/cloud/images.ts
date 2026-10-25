import type { CloudClient } from "./client";
import type { RecordValue } from "./types";
const bucket = "card-images";
const pending = new Map<string, Promise<string>>();
const downloads = new Map<string, Promise<string>>();
async function uploadImage(client: CloudClient, owner: string, data: string) {
  const blob = await (await fetch(data)).blob();
  if (
    blob.size > 3 * 1024 * 1024 ||
    !/^image\/(png|jpeg|webp|gif)$/.test(blob.type)
  )
    throw new Error("Недопустимое изображение");
  const hash = [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()),
    ),
  ]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
  const path = `${owner}/${hash}`;
  const key = `${owner}:${hash}`;
  let request = pending.get(key);
  if (!request) {
    request = (async () => {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, blob, { contentType: blob.type, upsert: false });
      if (
        error &&
        !["409", "Duplicate"].includes(
          String((error as { statusCode?: string }).statusCode),
        ) &&
        !/already exists/i.test(error.message)
      )
        throw error;
      return `storage://${path}`;
    })();
    pending.set(key, request);
    request.catch(() => pending.delete(key));
  }
  return request;
}
async function downloadImage(client: CloudClient, owner: string, path: string) {
  if (!path.startsWith(`${owner}/`))
    throw new Error("Изображение принадлежит другому аккаунту");
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) throw error;
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(data);
  });
}
export async function transformImages(
  client: CloudClient,
  owner: string,
  value: RecordValue | null,
  direction: "upload" | "download",
): Promise<RecordValue | null> {
  async function visit(value: unknown): Promise<unknown> {
    if (
      typeof value === "string" &&
      direction === "upload" &&
      /^data:image\//.test(value)
    )
      return uploadImage(client, owner, value);
    if (
      typeof value === "string" &&
      direction === "download" &&
      value.startsWith("storage://")
    ) {
      const key = `${owner}:${value}`;
      let request = downloads.get(key);
      if (!request) {
        request = downloadImage(client, owner, value.slice(10));
        downloads.set(key, request);
        request.catch(() => downloads.delete(key));
      }
      return request;
    }
    if (Array.isArray(value)) return Promise.all(value.map(visit));
    if (value && typeof value === "object")
      return Object.fromEntries(
        await Promise.all(
          Object.entries(value).map(async ([k, v]) => [k, await visit(v)]),
        ),
      );
    return value;
  }
  return (await visit(value)) as RecordValue | null;
}
export function clearImageRequests() {
  pending.clear();
  downloads.clear();
}

export function resetUploadChecks() {
  pending.clear();
}
