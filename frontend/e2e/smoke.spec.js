const { test, expect } = require("@playwright/test");

test("landing page loads and shows app title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/bizarre/i);
});
