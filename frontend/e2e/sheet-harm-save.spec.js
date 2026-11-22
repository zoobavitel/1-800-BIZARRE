/**
 * Harm typed on the sheet is saved (prod 2026-11-15: the GM set Lv1, Lv2 and
 * Lv3 harm on a player's sheet and none of it saved).
 *
 * Needs a running backend. Skipped unless E2E_API_URL is set; see
 * sheet-version.spec.js for the setup. The character is in a campaign so the
 * open tab gets live events, as in prod.
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
  const username = `e2e_harm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${API}/accounts/signup/`, {
    data: { username, password: `pw-${username}-local` },
  });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
});

async function openCampaignSheet(page, request) {
  const campaign = await api(request, "POST", "/campaigns/", { name: "Harm" });
  const ch = await api(request, "POST", "/characters/", {
    true_name: "Hurt",
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

test("harm typed into Lv1, Lv2 and Lv3 is saved", async ({ page, request }) => {
  const id = await openCampaignSheet(page, request);

  // Wait between slots so each one saves on its own, as in prod.
  await page.getByPlaceholder("Lv1 harm").first().fill("Bruised");
  await page.waitForTimeout(2500);
  await page.getByPlaceholder("Lv2 harm").first().fill("Cut");
  await page.waitForTimeout(2500);
  await page.getByPlaceholder("Lv3 harm").first().fill("Broken arm");

  const serverHarm = async () => {
    const c = await api(request, "GET", `/characters/${id}/`);
    return [c.harm_level1_name, c.harm_level2_name, c.harm_level3_name];
  };
  await expect
    .poll(serverHarm, { timeout: 15_000 })
    .toEqual(["Bruised", "Cut", "Broken arm"]);

  // Still saved and on screen after the save's own live event and refetch.
  await page.waitForTimeout(5000);
  expect(await serverHarm()).toEqual(["Bruised", "Cut", "Broken arm"]);
  await expect(page.getByPlaceholder("Lv1 harm").first()).toHaveValue("Bruised");
  await expect(page.getByPlaceholder("Lv2 harm").first()).toHaveValue("Cut");
  await expect(page.getByPlaceholder("Lv3 harm").first()).toHaveValue("Broken arm");
});

test("harm another device saves shows on the open sheet", async ({
  page,
  request,
}) => {
  const id = await openCampaignSheet(page, request);
  await api(request, "PATCH", `/characters/${id}/`, {
    harm_level2_used: true,
    harm_level2_name: "Shot",
  });
  await expect(page.getByPlaceholder("Lv2 harm").first()).toHaveValue("Shot", {
    timeout: 15_000,
  });
});

test("harm cleared on the sheet stays cleared", async ({ page, request }) => {
  const id = await openCampaignSheet(page, request);
  await page.getByPlaceholder("Lv1 harm").first().fill("Bruised");
  await expect
    .poll(async () => (await api(request, "GET", `/characters/${id}/`)).harm_level1_name, {
      timeout: 15_000,
    })
    .toBe("Bruised");
  await page.waitForTimeout(3000);
  await page.getByPlaceholder("Lv1 harm").first().fill("");
  await expect
    .poll(async () => (await api(request, "GET", `/characters/${id}/`)).harm_level1_used, {
      timeout: 15_000,
    })
    .toBe(false);
  await page.waitForTimeout(5000);
  const c = await api(request, "GET", `/characters/${id}/`);
  expect(c.harm_level1_used).toBe(false);
  await expect(page.getByPlaceholder("Lv1 harm").first()).toHaveValue("");
});

// Prod case: the GM sets harm on a player's PC from the sheet.
test("GM harm on a player's sheet is saved", async ({ page, request }) => {
  const as = (authToken) => async (method, path, data) => {
    const res = await request.fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Token ${authToken}` },
      ...(data ? { data } : {}),
    });
    expect(res.ok(), `${method} ${path} -> ${res.status()}`).toBeTruthy();
    return res.json();
  };
  const gm = as(token);
  const playerName = `e2e_harm_pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const signup = await request.post(`${API}/accounts/signup/`, {
    data: { username: playerName, password: `pw-${playerName}-local` },
  });
  expect(signup.ok()).toBeTruthy();
  const player = as((await signup.json()).token);

  const campaign = await gm("POST", "/campaigns/", { name: "Harm GM" });
  await gm("POST", `/campaigns/${campaign.id}/invite/`, { username: playerName });
  const invites = await player("GET", "/campaign-invitations/");
  const invite = (invites.results || invites).find(
    (i) => i.campaign_id === campaign.id,
  );
  await player("POST", `/campaign-invitations/${invite.id}/accept/`);
  const ch = await player("POST", "/characters/", {
    true_name: "Their PC",
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
  await expect(page.getByPlaceholder("Lv1 harm").first()).toBeVisible({
    timeout: 20_000,
  });
  await page.waitForTimeout(4000);

  await page.getByPlaceholder("Lv1 harm").first().fill("Bruised");
  await page.waitForTimeout(2500);
  await page.getByPlaceholder("Lv2 harm").first().fill("Cut");
  await page.waitForTimeout(2500);
  await page.getByPlaceholder("Lv3 harm").first().fill("Broken arm");

  const serverHarm = async () => {
    const c = await gm("GET", `/characters/${ch.id}/`);
    return [c.harm_level1_name, c.harm_level2_name, c.harm_level3_name];
  };
  await expect
    .poll(serverHarm, { timeout: 15_000 })
    .toEqual(["Bruised", "Cut", "Broken arm"]);
  await page.waitForTimeout(5000);
  expect(await serverHarm()).toEqual(["Bruised", "Cut", "Broken arm"]);
});
