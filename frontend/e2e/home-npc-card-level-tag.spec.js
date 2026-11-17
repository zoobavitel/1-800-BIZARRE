const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

// Layout check for the Home NPC card tag row. jsdom has no layout, so this
// renders the real Home.css in a browser at a fixed card width.
const homeCss = fs.readFileSync(
  path.join(__dirname, "..", "src", "styles", "Home.css"),
  "utf8",
);

function cardHtml(role, width) {
  return `<!doctype html><html><head><style>${homeCss}</style></head><body>
    <div class="home-poc">
      <div class="npc-card" style="width:${width}px">
        <div class="npc-card-body">
          <div class="npc-card-info">
            <div class="npc-card-name">Test NPC</div>
            <div class="npc-card-meta">
              <span class="p-tag" data-testid="lv">Lv 3</span>
              <span class="p-tag" data-testid="role">${role}</span>
            </div>
          </div>
        </div>
      </div>
    </div></body></html>`;
}

async function tagBox(page, testId) {
  return page.getByTestId(testId).evaluate((el) => ({
    clientWidth: el.clientWidth,
    scrollWidth: el.scrollWidth,
  }));
}

for (const width of [160, 120]) {
  test(`long role keeps Lv tag readable at ${width}px`, async ({ page }) => {
    await page.setContent(
      cardHtml("Underworld information broker and part-time chef", width),
    );
    const lv = await tagBox(page, "lv");
    expect(lv.clientWidth).toBeGreaterThan(0);
    expect(lv.scrollWidth).toBeLessThanOrEqual(lv.clientWidth);
    const role = await tagBox(page, "role");
    // The role is the tag that truncates.
    expect(role.scrollWidth).toBeGreaterThan(role.clientWidth);
  });
}

test("short role shows both tags in full", async ({ page }) => {
  await page.setContent(cardHtml("Fixer", 160));
  for (const id of ["lv", "role"]) {
    const box = await tagBox(page, id);
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth);
  }
});
