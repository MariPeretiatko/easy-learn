import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
test.skip(
  process.env.E2E_CLOUD !== "1",
  "Requires local Supabase; run npm run test:cloud:browser",
);
const base = "http://127.0.0.1:4175";
const ids: string[] = [];
const email = `browser-${randomUUID()}@example.test`,
  password = `Test-${randomUUID()}!`;
function admin() {
  return createClient(
    process.env.E2E_LOCAL_SUPABASE_URL!,
    process.env.E2E_LOCAL_SERVICE_KEY!,
    { auth: { persistSession: false } },
  );
}
test.beforeAll(async () => {
  if (process.env.E2E_CLOUD !== "1") return;
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  ids.push(data.user.id);
});
test.afterAll(async () => {
  if (process.env.E2E_CLOUD !== "1") return;
  for (const id of ids) {
    const files = await admin()
      .storage.from("card-images")
      .list(id, { limit: 1000 });
    if (files.data?.length)
      await admin()
        .storage.from("card-images")
        .remove(files.data.map((file) => `${id}/${file.name}`));
    const result = await admin().auth.admin.deleteUser(id);
    if (result.error) throw result.error;
  }
});
async function login(page: Page, address = email) {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).fill(address);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page).toHaveURL(`${base}/library`);
}
test("login, two-device synchronization, offline edits and logout isolation", async ({
  page,
  browser,
}) => {
  const metrics = { rpcRequests: 0, rpcBodyBytes: 0, storageRequests: 0 };
  const observe = (source: Page) =>
    source.on("request", (request) => {
      if (request.url().includes("/rest/v1/rpc/")) {
        metrics.rpcRequests++;
        metrics.rpcBodyBytes += request.postDataBuffer()?.byteLength ?? 0;
      }
      if (request.url().includes("/storage/v1/")) metrics.storageRequests++;
    });
  observe(page);
  await login(page);
  await page.goto(`${base}/create-set`);
  const title = `Cloud ${randomUUID()}`;
  await page.getByLabel("Название колоды").fill(title);
  await page.getByLabel("Термин 1", { exact: true }).fill("Haus");
  await page.getByLabel("Определение 1", { exact: true }).fill("дом");
  await page.getByLabel("Изображение 1", { exact: true }).setInputFiles({
    name: "card.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await page
    .getByRole("button", { name: "Сохранить колоду", exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/sets\//);
  const url = page.url();
  await page
    .getByRole("button", { name: "Синхронизировать", exact: true })
    .click();
  await expect(
    page.getByText("Сохранено в облаке", { exact: true }),
  ).toBeVisible();
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    observe(second);
    await login(second);
    await expect(
      second.getByText("Сохранено в облаке", { exact: true }),
    ).toBeVisible();
    await second.goto(url);
    await expect(
      second.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(second.locator(".set-term-row img")).toHaveCount(1);
    await page.evaluate(() =>
      navigator.serviceWorker.ready.then(() => undefined),
    );
    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: "Редактировать колоду", exact: true })
      .click();
    await page.getByLabel("Термин 1", { exact: true }).fill("Baum offline");
    await page
      .getByRole("button", { name: "Сохранить колоду", exact: true })
      .first()
      .click();
    await expect(page.locator(".set-term-row>strong")).toHaveText([
      "Baum offline",
    ]);
    await page.context().setOffline(false);
    await page
      .getByRole("button", { name: "Синхронизировать", exact: true })
      .click();
    await expect(
      page.getByText("Сохранено в облаке", { exact: true }),
    ).toBeVisible();
    await second
      .getByRole("button", { name: "Синхронизировать", exact: true })
      .click();
    await expect(second.locator(".set-term-row>strong")).toHaveText([
      "Baum offline",
    ]);
    await second.reload();
    await expect(
      second.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await page.goto(`${base}/settings`);
    await page
      .getByRole("button", { name: "Выйти", exact: true })
      .last()
      .click();
    await expect(
      page.getByRole("heading", { name: "Войти", exact: true }),
    ).toBeVisible();
    await page.goto(url);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toHaveCount(0);
    await expect(
      second.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  } finally {
    await other.close();
    console.log("Two-device metrics:", JSON.stringify(metrics));
  }
});
test("registration validates password confirmation and sends a confirmation email", async ({
  page,
}) => {
  test.setTimeout(90000);
  const address = `signup-${randomUUID()}@example.test`;
  await page.goto(`${base}/register`);
  await page.getByLabel("Имя", { exact: true }).fill("Новый пользователь");
  await page.getByLabel("Email", { exact: true }).fill(address);
  await page.getByLabel("Пароль", { exact: true }).fill(password);
  await page
    .getByLabel("Повторите пароль", { exact: true })
    .fill("different-password");
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Пароли не совпадают");
  await page.getByLabel("Повторите пароль", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Регистрация", exact: true }).click();
  await expect(
    page.getByText("Проверьте почту и подтвердите адрес по ссылке в письме.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Отправить письмо ещё раз", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("через минуту");
  await page.evaluate(() => {
    const native = Date.now;
    (window as unknown as { restoreNow: () => void }).restoreNow = () => {
      Date.now = native;
    };
    Date.now = () => native() + 61000;
  });
  await page
    .getByRole("button", { name: "Отправить письмо ещё раз", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("Слишком много попыток");
  await page.evaluate(() =>
    (window as unknown as { restoreNow: () => void }).restoreNow(),
  );
  // Exercise the real server throttle, then the successful retry after it expires.
  await page.waitForTimeout(61000);
  await page
    .getByRole("button", { name: "Отправить письмо ещё раз", exact: true })
    .click();
  await expect(
    page.getByText("Письмо отправлено повторно. Проверьте почту.", {
      exact: true,
    }),
  ).toBeVisible();
  const { data } = await admin().auth.admin.listUsers();
  const created = data.users.find((user) => user.email === address);
  expect(created).toBeTruthy();
  if (created) ids.push(created.id);
  await page.goto(await emailLink(address, "Confirm"));
  await expect(page).toHaveURL(`${base}/library`);
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Выйти", exact: true }).last().click();
  await page.goto(`${base}/forgot-password`);
  await page.getByLabel("Email", { exact: true }).fill(address);
  await page
    .getByRole("button", { name: "Восстановить пароль", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Если для этого адреса" }),
  ).toBeVisible();
  await page.goto(await emailLink(address, "Reset"));
  await expect(page).toHaveURL(`${base}/reset-password`);
  const nextPassword = `${password}-new`;
  await page.getByLabel("Пароль", { exact: true }).fill(nextPassword);
  await page.getByLabel("Повторите пароль", { exact: true }).fill(nextPassword);
  await page.getByRole("button", { name: "Новый пароль", exact: true }).click();
  await expect(page).toHaveURL(`${base}/settings`);
});

async function emailLink(address: string, subject: string): Promise<string> {
  let id = "";
  await expect
    .poll(async () => {
      const response = await fetch("http://127.0.0.1:54324/api/v1/messages");
      const mailbox = (await response.json()) as {
        messages: { ID: string; Subject: string; To: { Address: string }[] }[];
      };
      id =
        mailbox.messages.find(
          (message) =>
            message.Subject.includes(subject) &&
            message.To.some((to) => to.Address === address),
        )?.ID ?? "";
      return !!id;
    })
    .toBeTruthy();
  const message = (await (
    await fetch(`http://127.0.0.1:54324/api/v1/message/${id}`)
  ).json()) as { HTML: string; Text: string };
  const link = (message.HTML || message.Text).match(
    /https?:[^"<>\s]*\/auth\/v1\/verify[^"<>\s]*/,
  )?.[0];
  if (!link) throw new Error("Confirmation link missing from local mail");
  return link.replaceAll("&amp;", "&");
}

test("guest library is imported explicitly and survives a second-device login", async ({
  page,
  browser,
}) => {
  const title = `Guest ${randomUUID()}`;
  // Seed an existing pre-login library from the previous standalone version.
  await page.goto(`${base}/login`);
  await page.evaluate(async (title) => {
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open("easy-learn", 20);
      open.onupgradeneeded = () => {
        const database = open.result;
        for (const name of [
          "words",
          "decks",
          "texts",
          "videos",
          "reviews",
          "statistics",
          "recent",
          "drafts",
          "collections",
          "solutions",
          "testResults",
        ])
          if (!database.objectStoreNames.contains(name))
            database.createObjectStore(name, {
              keyPath:
                name === "statistics"
                  ? "date"
                  : name === "recent"
                    ? "key"
                    : "id",
            });
      };
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const database = open.result;
        const tx = database.transaction(["words", "decks"], "readwrite");
        tx.objectStore("words").put({
          id: "legacy-guest-word",
          term: "Gastwort",
          translation: "слово гостя",
          language: "de",
          nativeLanguage: "ru",
          definition: "",
          example: "",
          pronunciation: "",
          ipa: "",
          partOfSpeech: "",
          gender: "",
          article: "",
          plural: "",
          verbForms: "",
          synonyms: "",
          antonyms: "",
          notes: "",
          tags: [],
          status: "new",
          difficulty: 2,
          interval: 0,
          createdAt: 1,
          updatedAt: 1,
          nextReviewAt: 1,
          reviewCount: 0,
          correctCount: 0,
          incorrectCount: 0,
          favorite: false,
          type: "word",
          separable: false,
          reflexive: false,
          preposition: "",
          grammaticalCase: "",
        });
        tx.objectStore("decks").put({
          id: "legacy-guest-deck",
          title,
          description: "",
          language: "de",
          tags: [],
          wordIds: ["legacy-guest-word"],
          createdAt: 1,
          updatedAt: 1,
          favorite: false,
        });
        tx.oncomplete = () => {
          database.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  }, title);
  await login(page);
  await page.goto(`${base}/settings`);
  await page
    .getByRole("button", {
      name: "Перенести библиотеку с этого устройства",
      exact: true,
    })
    .click();
  await expect(page.getByText(/Найдено:.*карточек/)).toBeVisible();
  await page
    .getByRole("button", { name: "Перенести в этот аккаунт", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Перенести в этот аккаунт", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByText("Сохранено в облаке", { exact: true }),
  ).toBeVisible();
  const stored = await admin()
    .from("sync_records")
    .select("kind,data")
    .eq("owner_id", ids[0])
    .eq("deleted", false);
  if (stored.error) throw stored.error;
  const physical = JSON.parse(
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
        "-t",
        "-A",
        "-c",
        "select json_build_object('recordsRelationBytes',pg_total_relation_size('public.sync_record_data')+pg_total_relation_size('public.card_progress'),'localDatabaseBytes',pg_database_size(current_database()))",
      ],
      { encoding: "utf8" },
    ),
  );
  const files = await admin().storage.from("card-images").list(ids[0]);
  const storedFileBytes =
    files.data?.reduce(
      (sum, file) => sum + Number(file.metadata?.size ?? 0),
      0,
    ) ?? 0;
  console.log(
    "Prepared-catalog import metrics:",
    JSON.stringify({
      importedLegacyCards: 1,
      cloudRecords: stored.data.length,
      cloudJsonBytes: Buffer.byteLength(JSON.stringify(stored.data)),
      cloudCards: stored.data.filter((row) => row.kind === "words").length,
      storedFileBytes,
      ...physical,
    }),
  );
  const context = await browser.newContext();
  try {
    const second = await context.newPage();
    await login(second);
    await expect(
      second.getByText("Сохранено в облаке", { exact: true }),
    ).toBeVisible();
    await expect(
      second.getByText(title, { exact: true }).first(),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("invalid login and expired callback show errors without exposing account data", async ({
  page,
}) => {
  await page.goto(`${base}/login`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Пароль", { exact: true }).fill("incorrect-password");
  await page.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Неверный email или пароль",
  );
  await page.goto(`${base}/auth/callback?code=expired-code`);
  await expect(page.getByRole("alert")).toContainText(
    "Ссылка недействительна или истекла",
  );
});

test("signing out updates another tab in the same browser", async ({
  page,
  context,
}) => {
  await login(page);
  const other = await context.newPage();
  await other.goto(`${base}/settings`);
  await expect(
    other.getByRole("button", { name: "Выйти", exact: true }).last(),
  ).toBeVisible();
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Выйти", exact: true }).last().click();
  await expect(
    other.getByRole("heading", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    other.getByRole("button", { name: "Выйти", exact: true }),
  ).toHaveCount(0);
});

test("an expired revoked session returns to login and can sign in again", async ({
  page,
}) => {
  await login(page);
  const session = await page.evaluate(() => {
    const key = Object.keys(localStorage).find(
      (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
    );
    if (!key) throw new Error("Session key missing");
    return {
      key,
      value: JSON.parse(localStorage.getItem(key)!) as {
        access_token: string;
        expires_at: number;
      },
    };
  });
  const revoked = await admin().auth.admin.signOut(
    session.value.access_token,
    "global",
  );
  expect(revoked.error).toBeNull();
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        ...value,
        expires_at: Math.floor(Date.now() / 1000) - 3600,
      }),
    );
  }, session);
  await page.reload();
  await page.goto(`${base}/settings`);
  await expect(
    page.getByRole("heading", { name: "Войти", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Выйти", exact: true }),
  ).toHaveCount(0);
  await login(page);
});

test("switching accounts while a draft write is blocked keeps the draft with its original owner", async ({
  page,
  context,
}) => {
  const otherEmail = `switch-${randomUUID()}@example.test`;
  const otherUser = await admin().auth.admin.createUser({
    email: otherEmail,
    password,
    email_confirm: true,
  });
  if (otherUser.error) throw otherUser.error;
  ids.push(otherUser.data.user.id);
  await login(page);
  const second = await context.newPage();
  await second.goto(`${base}/login`);
  await second.getByLabel("Email", { exact: true }).fill(otherEmail);
  await second.getByLabel("Пароль", { exact: true }).fill(password);
  await page.goto(`${base}/create-set`);
  await expect(page.getByLabel("Название колоды")).toBeVisible();
  await page.evaluate(async (owner) => {
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(`easy-learn-user-${owner}`);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    let stopped = false;
    (window as unknown as { releaseDraftWrite: () => void }).releaseDraftWrite =
      () => {
        stopped = true;
      };
    const transaction = connection.transaction("drafts", "readwrite"),
      store = transaction.objectStore("drafts");
    const keepAlive = () => {
      const request = store.get("hold");
      request.onsuccess = () => {
        if (!stopped) keepAlive();
      };
    };
    transaction.oncomplete = () => connection.close();
    keepAlive();
  }, ids[0]);
  const title = `Pending ${randomUUID()}`;
  await page.getByLabel("Название колоды").fill(title);
  await page.getByLabel("Термин 1", { exact: true }).fill("Pending word");
  await page
    .getByLabel("Определение 1", { exact: true })
    .fill("незавершённая запись");
  await second.getByRole("button", { name: "Войти", exact: true }).click();
  await expect(
    page.getByText("Открываем вашу библиотеку…", { exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    (
      window as unknown as { releaseDraftWrite: () => void }
    ).releaseDraftWrite(),
  );
  await expect(second).toHaveURL(`${base}/library`);
  await expect(second.getByText(title, { exact: true })).toHaveCount(0);
  await login(page);
  await expect(page.locator(".draft-row")).toContainText(title);
  const foreign = await admin()
    .from("sync_records")
    .select("data")
    .eq("owner_id", otherUser.data.user.id);
  expect(JSON.stringify(foreign.data)).not.toContain(title);
});
