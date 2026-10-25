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

async function openSheet(page, request, trueName) {
  const ch = await api(request, "POST", "/characters/", {
    true_name: trueName,
    heritage: 1,
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
