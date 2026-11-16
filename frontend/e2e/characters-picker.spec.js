/**
 * Menu "Characters" (#character) shows a picker, not a blank new sheet
 * (story: Characters picker).
 *
 * Needs a running backend. Skipped unless E2E_API_URL is set; see
 * sheet-version.spec.js for the setup.
 */
const { test, expect } = require("@playwright/test");

const API = process.env.E2E_API_URL;
const appUrl = (
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000/1-800-BIZARRE"
).replace(/\/+$/, "");

test.skip(!API, "E2E_API_URL not set (needs a running backend)");

let token;
let pc;
let npc;

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
  const username = `e2e_pick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request.post(`${API}/accounts/signup/`, {
    data: { username, password: `pw-${username}-local` },
  });
  expect(res.ok()).toBeTruthy();
  token = (await res.json()).token;
  pc = await api(request, "POST", "/characters/", {
    true_name: "Picked PC",
    heritage: 1,
  });
  npc = await api(request, "POST", "/npcs/", { name: "Picked NPC" });
});

async function open(page, hash) {
  await page.addInitScript(
    ([apiBase, authToken]) => {
      window.localStorage.setItem("apiBaseUrl", apiBase);
      window.localStorage.setItem("authToken", authToken);
    },
    [API, token],
  );
  await page.goto(`${appUrl}/#${hash}`);
}

const pcPicker = (page) => page.getByLabel("Choose character to view");
const npcPicker = (page) => page.getByLabel("Choose NPC to view");

test("#character shows the picker with PCs, NPCs and both new buttons", async ({
  page,
}) => {
  await open(page, "character");
  await expect(pcPicker(page)).toBeVisible({ timeout: 20_000 });
  await expect(npcPicker(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New PC" })).toBeVisible();
  await expect(page.getByRole("button", { name: "+ New NPC" })).toBeVisible();
  // No blank sheet behind it.
  await expect(page.getByPlaceholder("Rival")).toHaveCount(0);
});

test("picking a PC opens it", async ({ page }) => {
  await open(page, "character");
  await pcPicker(page).selectOption(String(pc.id));
  await expect(page).toHaveURL(new RegExp(`#character/${pc.id}`));
  await expect(page.getByPlaceholder("Rival")).toBeVisible({ timeout: 20_000 });
});

test("picking an NPC opens the NPC sheet", async ({ page }) => {
  await open(page, "character");
  await npcPicker(page).selectOption(String(npc.id));
  await expect(page).toHaveURL(new RegExp(`#npcs/${npc.id}`));
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("input")].some(
        (el) => el.value === "Picked NPC",
      ),
    null,
    { timeout: 20_000 },
  );
});

test("+ New PC opens a blank PC sheet", async ({ page }) => {
  await open(page, "character");
  await page.getByRole("button", { name: "+ New PC" }).click({ timeout: 20_000 });
  await expect(page.getByPlaceholder("Rival")).toBeVisible({ timeout: 20_000 });
});

test("+ New NPC opens a blank NPC sheet", async ({ page }) => {
  await open(page, "character");
  await page.getByRole("button", { name: "+ New NPC" }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(/#npcs/);
  await expect(npcPicker(page)).toHaveCount(0);
  await expect(page.getByText("New NPC").first()).toBeVisible({ timeout: 20_000 });
});

test("#character/new still opens a blank sheet", async ({ page }) => {
  await open(page, "character/new");
  await expect(page.getByPlaceholder("Rival")).toBeVisible({ timeout: 20_000 });
});

test("a PC link still opens that PC", async ({ page }) => {
  await open(page, `character/${pc.id}`);
  await expect(page.getByPlaceholder("Rival")).toBeVisible({ timeout: 20_000 });
  await expect(pcPicker(page)).toHaveCount(0);
});
