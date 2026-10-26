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

// The next three came from the #246 verification pass. The field's value is
// sampled every 100 ms, so a brief jump back to the old value fails too.

async function slowPatches(page) {
  await page.route(/\/api\/characters\/\d+\/$/, async (route) => {
    if (route.request().method() === "PATCH") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    await route.continue();
  });
}

async function sampleValues(page, value, ms) {
  // Every distinct value seen in inputs that started as `value`.
  return page.evaluate(
    ([start, duration]) =>
      new Promise((resolve) => {
        const el = [...document.querySelectorAll("input,textarea")].find(
          (x) => x.value === start,
        );
        if (!el) {
          resolve(["<field not found>"]);
          return;
        }
        const seen = [el.value];
        const timer = setInterval(() => {
          if (seen[seen.length - 1] !== el.value) seen.push(el.value);
        }, 100);
        setTimeout(() => {
          clearInterval(timer);
          resolve(seen);
        }, duration);
      }),
    [value, ms],
  );
}

async function typeInto(page, from, to) {
  const handle = await page.evaluateHandle(
    (v) =>
      [...document.querySelectorAll("input,textarea")].find((x) => x.value === v),
    from,
  );
  await handle.asElement().fill(to);
}

test("this tab's own edit does not jump back during a slow save", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await slowPatches(page);
  await typeInto(page, "Before look", "Mine look");
  expect(await sampleValues(page, "Mine look", 8000)).toEqual(["Mine look"]);
  await expect
    .poll(async () => (await api(request, "GET", `/characters/${id}/`)).appearance, {
      timeout: 15_000,
    })
    .toBe("Mine look");
  await page.reload();
  await expectOnScreen(page, "Mine look", 20_000);
});

test("typing on during a slow save keeps the newest text", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await slowPatches(page);
  await typeInto(page, "Before Name", "Name A");
  await page.waitForTimeout(1800);
  await typeInto(page, "Name A", "Name AB");
  expect(await sampleValues(page, "Name AB", 8000)).toEqual(["Name AB"]);
  await expect
    .poll(async () => (await api(request, "GET", `/characters/${id}/`)).true_name, {
      timeout: 15_000,
    })
    .toBe("Name AB");
});

test("an outside change to one field leaves an unsaved edit in another", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await typeInto(page, "Before look", "Mine look");
  await api(request, "PATCH", `/characters/${id}/`, { true_name: "Device B Name" });
  await expectOnScreen(page, "Device B Name", 15_000);
  expect(await sampleValues(page, "Mine look", 3000)).toEqual(["Mine look"]);
  await expect
    .poll(async () => {
      const c = await api(request, "GET", `/characters/${id}/`);
      return `${c.true_name}|${c.appearance}`;
    }, { timeout: 15_000 })
    .toBe("Device B Name|Mine look");
});
