const { test, expect } = require("@playwright/test");

const appUrl =
  process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000/1-800-BIZARRE";

test("landing page loads and shows app title", async ({ page }) => {
  const url = appUrl.endsWith("/") ? appUrl : `${appUrl}/`;
  await page.goto(url);
  await expect(page).toHaveTitle(/bizarre/i);
});
