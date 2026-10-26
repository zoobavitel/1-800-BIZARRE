/**
 * An edit made on the sheet must reach the server even when a live event for
 * the same character arrives before its autosave runs (another device's save,
 * a GM change, a roll marking stress).
 *
 * Needs a running backend. Skipped unless E2E_API_URL is set; see
 * sheet-version.spec.js for the setup. The character is in a campaign so the
 * open tab gets live events.
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
  // Random suffix: parallel workers start in the same millisecond.
  const username = `e2e_edit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${API}/accounts/signup/`, {
    data: { username, password: `pw-${username}-local` },
  });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
});

async function openCampaignSheet(page, request) {
  const campaign = await api(request, "POST", "/campaigns/", { name: "Edits" });
  const ch = await api(request, "POST", "/characters/", {
    true_name: "Edit Sync",
    heritage: 1,
    campaign: campaign.id,
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
  // Let the first render settle (hydrate, first autosave, stream connect).
  await page.waitForTimeout(4000);
  return ch.id;
}

const serverRival = (request, id) => async () =>
  (await api(request, "GET", `/characters/${id}/`)).rival;

test("an edit saves when no event arrives", async ({ page, request }) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Rival").fill("Typed here");
  await expect.poll(serverRival(request, id), { timeout: 15_000 }).toBe("Typed here");
});

test("an edit saves when another device's change arrives first", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Rival").fill("Typed here");
  // Within the 1.5 s autosave debounce.
  await api(request, "PATCH", `/characters/${id}/`, { appearance: "Outside" });
  await expect.poll(serverRival(request, id), { timeout: 15_000 }).toBe("Typed here");
  expect((await api(request, "GET", `/characters/${id}/`)).appearance).toBe(
    "Outside",
  );
});

test("an edit saves when a stress change arrives first", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Rival").fill("Typed here");
  // Server-owned field, like a roll or the GM marking stress.
  await api(request, "PATCH", `/characters/${id}/`, { stress: 2 });
  await expect.poll(serverRival(request, id), { timeout: 15_000 }).toBe("Typed here");
  expect((await api(request, "GET", `/characters/${id}/`)).stress).toBe(2);
});

test("a second edit after the event also saves", async ({ page, request }) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Rival").fill("First");
  await api(request, "PATCH", `/characters/${id}/`, { appearance: "Outside" });
  await page.waitForTimeout(300);
  await page.getByPlaceholder("Close friend").fill("Second");
  await expect
    .poll(async () => {
      const c = await api(request, "GET", `/characters/${id}/`);
      return `${c.rival}|${c.close_friend}`;
    }, { timeout: 15_000 })
    .toBe("First|Second");
});
