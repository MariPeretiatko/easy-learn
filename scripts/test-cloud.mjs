import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const config = JSON.parse(
  execFileSync("node_modules/.bin/supabase", ["status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const client = () =>
  createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false },
  });
const password = `Test-${randomUUID()}!`;
const users = [];
try {
  const accounts = [];
  for (let i = 0; i < 2; i++) {
    const email = `cloud-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Cloud Test" },
    });
    assert.ifError(created.error);
    users.push(created.data.user.id);
    const api = client();
    assert.ifError(
      (await api.auth.signInWithPassword({ email, password })).error,
    );
    accounts.push(api);
  }
  const [a, b] = accounts;
  const anon = client();
  const make = (table, key, before, value) => ({ table, key, before, value });
  const apply = (api, changes, id = randomUUID()) =>
    api.rpc("apply_sync_batch", { operation_id: id, changes });
  const word = { id: "card", term: "Haus", translation: "дом", notes: "" };
  const deck = { id: "deck", title: "Deck", wordIds: ["card"] };
  const operation = randomUUID();
  const first = await apply(
    a,
    [make("words", "card", null, word), make("decks", "deck", null, deck)],
    operation,
  );
  assert.ifError(first.error);
  assert.equal(first.data.ok, true);
  assert.equal(first.data.records.length, 2);
  const retry = await apply(
    a,
    [make("words", "card", null, word), make("decks", "deck", null, deck)],
    operation,
  );
  assert.ifError(retry.error);
  assert.deepEqual(retry.data, first.data);
  assert.equal((await b.from("sync_records").select("*")).data.length, 0);
  assert.equal(
    (await anon.from("sync_records").select("*")).data?.length ?? 0,
    0,
  );
  assert.ok(
    (await apply(anon, [make("words", "attack", null, { id: "attack" })]))
      .error,
  );
  assert.ok(
    (
      await a.from("sync_records").insert({
        owner_id: users[1],
        kind: "words",
        record_id: "attack",
        data: { id: "attack" },
      })
    ).error,
  );
  assert.ok(
    (
      await apply(b, [
        make("decks", "foreign", null, { id: "foreign", wordIds: ["card"] }),
      ])
    ).error,
  );
  assert.equal((await b.from("sync_records").select("*")).data.length, 0);
  const edit = await apply(a, [
    make("words", "card", word, { ...word, notes: "device A" }),
  ]);
  assert.ifError(edit.error);
  assert.equal(edit.data.ok, true);
  const disjoint = await apply(a, [
    make("words", "card", word, { ...word, term: "Baum" }),
  ]);
  assert.ifError(disjoint.error);
  assert.equal(disjoint.data.ok, true);
  assert.equal(disjoint.data.records[0].data.notes, "device A");
  assert.equal(disjoint.data.records[0].data.term, "Baum");
  const replayAfterUpdate = await apply(
    a,
    [make("words", "card", null, word), make("decks", "deck", null, deck)],
    operation,
  );
  assert.equal(
    replayAfterUpdate.data.records.find((r) => r.kind === "words").data.notes,
    "device A",
  );
  const conflict = await apply(a, [
    make("words", "card", word, { ...word, notes: "device B" }),
    make("texts", "should-rollback", null, { id: "should-rollback" }),
  ]);
  assert.ifError(conflict.error);
  assert.equal(conflict.data.ok, false);
  assert.equal(
    (
      await a
        .from("sync_records")
        .select("*")
        .eq("record_id", "should-rollback")
    ).data.length,
    0,
  );
  const current = disjoint.data.records[0].data;
  const removed = await apply(a, [
    make("decks", "deck", deck, null),
    make("words", "card", current, null),
  ]);
  assert.ifError(removed.error);
  assert.equal(removed.data.ok, true);
  const stale = await apply(a, [
    make("words", "card", word, { ...word, notes: "stale" }),
  ]);
  assert.equal(stale.data.ok, false);
  const restored = await apply(a, [
    { ...make("words", "card", null, word), restore: true },
  ]);
  assert.ifError(restored.error);
  assert.equal(restored.data.ok, true);
  const recent = await apply(a, [
    make("recent", "decks/deck", null, {
      key: "decks/deck",
      id: "deck",
      kind: "decks",
      title: "Deck",
      timestamp: 1,
    }),
  ]);
  assert.ifError(recent.error);
  assert.equal(recent.data.ok, true);
  const stagedId = randomUUID();
  const stage = (part, changes) =>
    a.rpc("stage_sync_batch", {
      operation_id: stagedId,
      part_no: part,
      total_parts: 2,
      changes,
    });
  const part1 = await stage(0, [
    make("texts", "staged-a", null, { id: "staged-a" }),
  ]);
  assert.ifError(part1.error);
  assert.equal(part1.data.staged, true);
  assert.equal(
    (await a.from("sync_records").select("*").eq("record_id", "staged-a")).data
      .length,
    0,
  );
  const part2 = await stage(1, [
    make("texts", "staged-b", null, { id: "staged-b" }),
  ]);
  assert.ifError(part2.error);
  assert.equal(part2.data.ok, true);
  assert.equal(part2.data.records.length, 2);
  const retryPart = await stage(0, [
    make("texts", "staged-a", null, { id: "staged-a" }),
  ]);
  assert.ifError(retryPart.error);
  assert.equal(retryPart.data.records.length, 2);
  const baseCard = (
    await a
      .from("sync_records")
      .select("data")
      .eq("kind", "words")
      .eq("record_id", "card")
      .single()
  ).data.data;
  const derivedBefore = {
    ...baseCard,
    status: "learning",
    reviewCount: 8,
    updatedAt: 200,
  };
  const contentEdit = await apply(a, [
    make("words", "card", derivedBefore, {
      ...derivedBefore,
      notes: "edit after review",
      updatedAt: 300,
    }),
  ]);
  assert.ifError(contentEdit.error);
  assert.equal(contentEdit.data.ok, true);
  assert.equal(contentEdit.data.records[0].data.notes, "edit after review");
  const resetCard = {
    ...contentEdit.data.records[0].data,
    reviewCount: 11,
    status: "mastered",
  };
  const reset = await apply(a, [
    {
      ...make("words", "card", contentEdit.data.records[0].data, resetCard),
      resetProgress: true,
    },
  ]);
  assert.ifError(reset.error);
  assert.equal(reset.data.records[0].data.reviewCount, 11);
  const material = await admin
    .from("sync_record_data")
    .select("data")
    .eq("owner_id", users[0])
    .eq("kind", "words")
    .eq("record_id", "card")
    .single();
  assert.ifError(material.error);
  assert.equal(material.data.data.reviewCount, undefined);
  const progress = await a
    .from("card_progress")
    .select("baseline")
    .eq("id", "card")
    .single();
  assert.ifError(progress.error);
  assert.equal(progress.data.baseline.reviewCount, 11);
  assert.equal(
    (await b.from("card_progress").select("*").eq("id", "card")).data.length,
    0,
  );
  const profile = await a.from("profiles").select("*").single();
  assert.ifError(profile.error);
  assert.equal(profile.data.id, users[0]);
  assert.equal(
    (await b.from("profiles").select("*").eq("id", users[0])).data.length,
    0,
  );
  const image = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const imagePath = `${users[0]}/${randomUUID()}`;
  assert.ifError(
    (
      await a.storage
        .from("card-images")
        .upload(imagePath, image, { contentType: "image/png" })
    ).error,
  );
  assert.ok((await b.storage.from("card-images").download(imagePath)).error);
  assert.ok(
    (
      await b.storage
        .from("card-images")
        .upload(`${users[0]}/attack`, image, { contentType: "image/png" })
    ).error,
  );
  assert.ifError(
    (await a.storage.from("card-images").remove([imagePath])).error,
  );
  assert.ok(
    (
      await a.auth.signInWithPassword({
        email: "nobody@example.test",
        password: "incorrect",
      })
    ).error,
  );
  console.log(
    "Cloud integration passed: Auth, profiles, RLS, cross-owner references, Storage, atomic RPC, replay, merge, conflict and tombstones.",
  );
} finally {
  for (const id of users) await admin.auth.admin.deleteUser(id);
}
