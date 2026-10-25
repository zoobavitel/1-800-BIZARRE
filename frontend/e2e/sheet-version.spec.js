/**
 * PR 7b: a stale sheet tab must not overwrite newer saves.
 *
 * Needs a running backend. Skipped unless E2E_API_URL is set, e.g.
 *   E2E_API_URL=http://127.0.0.1:8765/api PLAYWRIGHT_SKIP_WEBSERVER=1 \
 *   PLAYWRIGHT_BASE_URL=http://127.0.0.1:3765/1-800-BIZARRE \
 *   npx playwright test e2e/sheet-version.spec.js
 * The backend must allow the app's origin in CORS_ALLOWED_ORIGINS.
 *
 * "Another device" is a direct API write. The open tab gets no event for it
 * (the character is in no campaign), so the tab keeps its old copy: the
 * stale-tab case.
 */
const { test, expect } = require("@playwright/test");

const API = process.env.E2E_API_URL;
const appUrl = (
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000/1-800-BIZARRE"
).replace(/\/+$/, "");

test.skip(!API, "E2E_API_URL not set (needs a running backend)");

let token;

async function api(request, method, path, data) {
  const res = await request.fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Token ${token}` },
    ...(data ? { data } : {}),
  });
  expect(res.ok(), `${method} ${path} -> ${res.status()}`).toBeTruthy();
  return res.json();
}

test.beforeAll(async ({ request }) => {
  const username = `e2e_ver_${Date.now()}`;
  const res = await request.post(`${API}/accounts/signup/`, {
    data: { username, password: `pw-${username}-local` },
  });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
});

async function openSheet(page, request, trueName, extra = {}) {
  const ch = await api(request, "POST", "/characters/", {
    true_name: trueName,
    heritage: 1,
    ...extra,
  });
  await page.addInitScript(
    ([apiBase, authToken]) => {
      window.localStorage.setItem("apiBaseUrl", apiBase);
      window.localStorage.setItem("authToken", authToken);
    },
    [API, token],
  );
  await page.goto(`${appUrl}/#character/${ch.id}`);
  await expect(page.getByPlaceholder("Rival")).toBeVisible({ timeout: 20_000 });
  // Let the first render settle (hydrate, any first autosave).
  await page.waitForTimeout(3000);
  return ch.id;
}

// Slow every sheet PATCH by 2 s so edits can land while a save is in flight.
async function slowPatches(page) {
  await page.route(/\/api\/characters\/\d+\/$/, async (route) => {
    if (route.request().method() === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.continue();
  });
}

const isSheetPatch = (r) =>
  r.method() === "PATCH" && /\/api\/characters\/\d+\/$/.test(r.url());

async function waitForServer(request, id, check) {
  await expect
    .poll(async () => check(await api(request, "GET", `/characters/${id}/`)), {
      timeout: 15_000,
    })
    .toBeTruthy();
  return api(request, "GET", `/characters/${id}/`);
}

test("stale tab edit keeps another device's newer change", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Stale Tab");
  await api(request, "PATCH", `/characters/${id}/`, {
    background_note: "from other device",
  });

  await page.getByPlaceholder("Rival").fill("Diavolo");

  const row = await waitForServer(request, id, (c) => c.rival === "Diavolo");
  expect(row.background_note).toBe("from other device");
  await expect(page.getByTestId("sheet-conflict-banner")).toHaveCount(0);
});

test("same field changed on both: banner, Keep mine wins", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Keep Mine");
  await api(request, "PATCH", `/characters/${id}/`, { rival: "Pucci" });

  await page.getByPlaceholder("Rival").fill("Diavolo");

  const banner = page.getByTestId("sheet-conflict-banner");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await expect(banner).toContainText("Rival");
  // Autosave is paused: the server keeps the other device's value.
  await page.waitForTimeout(2500);
  expect((await api(request, "GET", `/characters/${id}/`)).rival).toBe("Pucci");

  await banner.getByRole("button", { name: "Keep mine" }).click();
  await waitForServer(request, id, (c) => c.rival === "Diavolo");
  await expect(banner).toHaveCount(0);
});

test("same field changed on both: Reload takes theirs, keeps other edits", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Reload Theirs");
  await api(request, "PATCH", `/characters/${id}/`, { rival: "Kars" });

  await page.getByPlaceholder("Rival").fill("Esidisi");
  await page.getByPlaceholder("Close friend").fill("Joseph");

  const banner = page.getByTestId("sheet-conflict-banner");
  await expect(banner).toBeVisible({ timeout: 15_000 });
  await banner.getByRole("button", { name: "Reload" }).click();

  const row = await waitForServer(request, id, (c) => c.close_friend === "Joseph");
  expect(row.rival).toBe("Kars");
  await expect(page.getByPlaceholder("Rival")).toHaveValue("Kars");
  await expect(page.getByPlaceholder("Close friend")).toHaveValue("Joseph");
});

// The next four came from the PR 7b verification pass.

test("a change undone while its save is in flight still reaches the server", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Undo In Flight", {
    rival: "Original",
  });
  await slowPatches(page);
  const first = page.waitForRequest(isSheetPatch);
  await page.getByPlaceholder("Rival").fill("Mistake");
  await first;
  await page.getByPlaceholder("Rival").fill("Original");
  await page.waitForTimeout(9000);
  await expect(page.getByPlaceholder("Rival")).toHaveValue("Original");
  expect((await api(request, "GET", `/characters/${id}/`)).rival).toBe(
    "Original",
  );
});

test("typing on while a save is in flight saves everything, no banner", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Typing In Flight");
  await slowPatches(page);
  const first = page.waitForRequest(isSheetPatch);
  await page.getByPlaceholder("Rival").fill("Dia");
  await first;
  await page.getByPlaceholder("Rival").fill("Diavolo");
  await page.getByPlaceholder("Close friend").fill("Doppio");
  await page.waitForTimeout(9000);
  const row = await api(request, "GET", `/characters/${id}/`);
  expect(row.rival).toBe("Diavolo");
  expect(row.close_friend).toBe("Doppio");
  await expect(page.getByTestId("sheet-conflict-banner")).toHaveCount(0);
});

test("after a silent retry the screen shows the other device's change", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Shows Theirs");
  await api(request, "PATCH", `/characters/${id}/`, {
    background_note: "from other device",
  });
  await page.getByPlaceholder("Rival").fill("Diavolo");
  await waitForServer(request, id, (c) => c.rival === "Diavolo");
  await expect(page.getByPlaceholder("Background")).toHaveValue(
    "from other device",
    { timeout: 10_000 },
  );
});

test("a reload after edits shows what the server saved", async ({
  page,
  request,
}) => {
  const id = await openSheet(page, request, "Reload Check");
  await page.getByPlaceholder("Rival").fill("Kira");
  await page.getByPlaceholder("Close friend").fill("Hayato");
  await waitForServer(request, id, (c) => c.close_friend === "Hayato");
  await page.reload();
  await expect(page.getByPlaceholder("Rival")).toHaveValue("Kira", {
    timeout: 20_000,
  });
  await expect(page.getByPlaceholder("Close friend")).toHaveValue("Hayato");
});
