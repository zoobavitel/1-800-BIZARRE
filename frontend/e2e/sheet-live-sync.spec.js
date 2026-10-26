/**
 * An open sheet shows another device's change to Name, Stand name, Background
 * and Look, the same way it already does for Rival.
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
  const username = `e2e_live_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${API}/accounts/signup/`, {
    data: { username, password: `pw-${username}-local` },
  });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
});

async function openCampaignSheet(page, request) {
  const campaign = await api(request, "POST", "/campaigns/", { name: "Live" });
  const ch = await api(request, "POST", "/characters/", {
    true_name: "Before Name",
    heritage: 1,
    campaign: campaign.id,
    stand_name: "Before Stand",
    background_note: "Before background",
    appearance: "Before look",
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
  await expectOnScreen(page, "Before background");
  // Let the first render settle (hydrate, first autosave, stream connect).
  await page.waitForTimeout(4000);
  return ch.id;
}

async function expectOnScreen(page, value, timeout = 10_000) {
  await page.waitForFunction(
    (v) =>
      [...document.querySelectorAll("input,textarea")].some(
        (el) => el.value === v,
      ),
    value,
    { timeout },
  );
}

test("another device's name, stand name, background and look show up", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await api(request, "PATCH", `/characters/${id}/`, {
    true_name: "After Name",
    stand_name: "After Stand",
    background_note: "After background",
    appearance: "After look",
  });
  for (const v of ["After Name", "After Stand", "After background", "After look"]) {
    await expectOnScreen(page, v);
  }
});

test("a field another device cleared shows as cleared", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await api(request, "PATCH", `/characters/${id}/`, { appearance: "" });
  await page.waitForFunction(
    () =>
      ![...document.querySelectorAll("input,textarea")].some(
        (el) => el.value === "Before look",
      ),
    null,
    { timeout: 10_000 },
  );
});

test("typing on this sheet is not overwritten by an outside change", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Rival").fill("Typed here");
  await api(request, "PATCH", `/characters/${id}/`, {
    appearance: "Outside look",
  });
  // Both end up on screen and on the server: the outside Look once this
  // sheet's save is done, the typed Rival throughout.
  await expectOnScreen(page, "Outside look", 15_000);
  await expect(page.getByPlaceholder("Rival")).toHaveValue("Typed here");
  await expect
    .poll(async () => (await api(request, "GET", `/characters/${id}/`)).rival, {
      timeout: 15_000,
    })
    .toBe("Typed here");
  expect((await api(request, "GET", `/characters/${id}/`)).appearance).toBe(
    "Outside look",
  );
});
