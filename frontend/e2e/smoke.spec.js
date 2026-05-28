const { test, expect } = require("@playwright/test");

test("landing page loads and shows app title", async ({ page }) => {
  // Leading "/" resolves from origin root, not baseURL path (/1-800-BIZARRE).
  await page.goto("./");
  await expect(page).toHaveTitle(/bizarre/i);
});
