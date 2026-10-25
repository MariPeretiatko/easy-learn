import { spawn, execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const config = JSON.parse(
  execFileSync("node_modules/.bin/supabase", ["status", "--output", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }),
);
const admin = createClient(config.API_URL, config.SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const port = 18000 + Math.floor(Math.random() * 10000);
const origin = "http://127.0.0.1:4175";
const cleanupMode = process.argv.includes("--cleanup");
const server = spawn(
  "npx",
  [
    "--yes",
    "deno@2.9.6",
    "run",
    "--no-lock",
    "--allow-env",
    "--allow-net",
    `supabase/functions/${cleanupMode ? "cleanup-images" : "delete-account"}/index.ts`,
  ],
  {
    detached: true,
    stdio: ["ignore", "ignore", "pipe"],
    env: {
      ...process.env,
      PORT: String(port),
      SUPABASE_URL: config.API_URL,
      SUPABASE_SERVICE_ROLE_KEY: config.SERVICE_ROLE_KEY,
      ALLOWED_ORIGINS: origin,
      DENO_NO_UPDATE_CHECK: "1",
    },
  },
);
let diagnostics = "";
server.stderr.on("data", (data) => {
  diagnostics += data.toString();
});
let id;
try {
  let ready = false;
  for (let i = 0; i < 600; i++) {
    if (server.exitCode !== null)
      throw new Error(`Deno function exited: ${diagnostics.slice(-2000)}`);
    try {
      await fetch(`http://127.0.0.1:${port}`, {
        method: "OPTIONS",
        headers: { Origin: origin },
      });
      ready = true;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(ready, `Function did not start: ${diagnostics.slice(-1000)}`);
  const email = `deletion-${randomUUID()}@example.test`,
    password = `Test-${randomUUID()}!`;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(created.error);
  id = created.data.user.id;
  const user = createClient(config.API_URL, config.ANON_KEY, {
    auth: { persistSession: false },
  });
  const login = await user.auth.signInWithPassword({ email, password });
  assert.ifError(login.error);
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  assert.ifError(
    (
      await user.storage
        .from("card-images")
        .upload(`${id}/test`, image, { contentType: "image/png" })
    ).error,
  );
  const endpoint = `http://127.0.0.1:${port}`;
  assert.equal(
    (await fetch(endpoint, { method: "POST", headers: { Origin: origin } }))
      .status,
    401,
  );
  assert.equal(
    (
      await fetch(endpoint, {
        method: "POST",
        headers: {
          Origin: "https://untrusted.example",
          Authorization: `Bearer ${login.data.session.access_token}`,
        },
      })
    ).status,
    403,
  );
  if (cleanupMode) {
    for (const name of ["used", "pending", "young"])
      assert.ifError(
        (
          await user.storage
            .from("card-images")
            .upload(`${id}/${name}`, image, { contentType: "image/png" })
        ).error,
      );
    assert.match(id, /^[0-9a-f-]{36}$/);
    execFileSync(
      "docker",
      [
        "exec",
        "supabase_db_easy-learn",
        "psql",
        "-U",
        "postgres",
        "-d",
        "postgres",
        "-c",
        `update storage.objects set created_at=now()-interval '8 days' where bucket_id='card-images' and name like '${id}/%' and name not like '%/young'`,
      ],
      { stdio: "ignore" },
    );
    const saved = await user.rpc("apply_sync_batch", {
      operation_id: randomUUID(),
      changes: [
        {
          table: "words",
          key: "used",
          before: null,
          value: { id: "used", image: `storage://${id}/used` },
        },
      ],
    });
    assert.ifError(saved.error);
    assert.equal(saved.data.ok, true);
    const staged = await user.rpc("stage_sync_batch", {
      operation_id: randomUUID(),
      part_no: 0,
      total_parts: 2,
      changes: [
        {
          table: "drafts",
          key: "pending",
          before: null,
          value: { id: "pending", image: `storage://${id}/pending` },
        },
      ],
    });
    assert.ifError(staged.error);
    assert.equal(staged.data.staged, true);
    assert.ok(
      (await user.rpc("begin_image_cleanup", { target_owner: id })).error,
    );
    const lock = await admin.rpc("begin_image_cleanup", { target_owner: id });
    assert.ifError(lock.error);
    assert.ok(
      (
        await user.rpc("apply_sync_batch", {
          operation_id: randomUUID(),
          changes: [
            {
              table: "texts",
              key: "blocked",
              before: null,
              value: { id: "blocked" },
            },
          ],
        })
      ).error,
    );
    assert.ok(
      (
        await user.storage
          .from("card-images")
          .upload(`${id}/blocked`, image, { contentType: "image/png" })
      ).error,
    );
    assert.ifError(
      (
        await admin.rpc("finish_image_cleanup", {
          target_owner: id,
          cleanup_token: lock.data,
        })
      ).error,
    );
    const cleaned = await fetch(endpoint, {
      method: "POST",
      headers: {
        Origin: origin,
        Authorization: `Bearer ${login.data.session.access_token}`,
      },
    });
    assert.equal(cleaned.status, 200);
    const result = await cleaned.json();
    assert.equal(result.ok, true);
    assert.equal(result.removed, 1);
    const files = await admin.storage.from("card-images").list(id);
    assert.deepEqual(files.data.map((file) => file.name).sort(), [
      "pending",
      "used",
      "young",
    ]);
    const unlocked = await user.rpc("apply_sync_batch", {
      operation_id: randomUUID(),
      changes: [
        { table: "texts", key: "after", before: null, value: { id: "after" } },
      ],
    });
    assert.ifError(unlocked.error);
    assert.equal(unlocked.data.ok, true);
    console.log(
      "Image cleanup passed: live/staged/young files preserved, old orphan removed, maintenance lock enforced and released.",
    );
  } else {
    const deleted = await fetch(endpoint, {
      method: "POST",
      headers: {
        Origin: origin,
        Authorization: `Bearer ${login.data.session.access_token}`,
      },
    });
    assert.equal(deleted.status, 200);
    assert.equal((await deleted.json()).ok, true);
    assert.ok((await admin.auth.admin.getUserById(id)).error);
    assert.equal(
      (await admin.storage.from("card-images").list(id)).data.length,
      0,
    );
    console.log(
      "Account deletion passed: token validation, origin checks, Storage cleanup and Auth deletion.",
    );
  }
} finally {
  if (id) {
    const files = await admin.storage.from("card-images").list(id);
    if (files.data?.length)
      await admin.storage
        .from("card-images")
        .remove(files.data.map((file) => `${id}/${file.name}`));
    await admin.auth.admin.deleteUser(id);
  }
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
}
