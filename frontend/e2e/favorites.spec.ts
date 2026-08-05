import { test, expect, Page } from "@playwright/test";

const EQNR_QUOTE = {
  symbol: "EQNR.OL",
  name: "Equinor",
  price: 300,
  change: 1.5,
  changePercent: 0.5,
  volume: 12345,
  previousClose: 298.5,
};

const EQNR_RETURNS = {
  symbol: "EQNR.OL",
  oneYear: 12.3,
  threeYear: -4.5,
  fiveYear: 30,
  dividendYield: 4.2,
  dividendChangePercent: 8,
};

async function mockApi(page: Page) {
  await page.route("**/api/yahoo/all-quotes**", (route) => {
    const url = new URL(route.request().url());
    const exchange = url.searchParams.get("exchange") ?? "OSL";
    return route.fulfill({ json: { quotes: exchange === "OSL" ? [EQNR_QUOTE] : [], fetchedAt: Date.now() } });
  });
  await page.route("**/api/yahoo/all-volume**", (route) =>
    route.fulfill({ json: { stocks: [], fetchedAt: Date.now() } })
  );
  await page.route("**/api/yahoo/all-valuation**", (route) =>
    route.fulfill({ json: { stocks: [], fetchedAt: Date.now() } })
  );
  await page.route("**/api/yahoo/all-financials**", (route) =>
    route.fulfill({ json: { stocks: [], fetchedAt: Date.now() } })
  );
  await page.route("**/api/yahoo/quotes-by-symbols**", (route) => {
    const url = new URL(route.request().url());
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const quotes = symbols.includes(EQNR_QUOTE.symbol) ? [EQNR_QUOTE] : [];
    return route.fulfill({ json: { quotes, fetchedAt: Date.now() } });
  });
  await page.route("**/api/yahoo/historical-returns**", (route) => {
    const url = new URL(route.request().url());
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const returns = symbols.includes(EQNR_RETURNS.symbol) ? [EQNR_RETURNS] : [];
    return route.fulfill({ json: { returns, fetchedAt: Date.now() } });
  });
}

function eqnrRow(page: Page) {
  return page.locator("tr.box-row", { hasText: "EQNR.OL" });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("favorite star toggles a stock on and off in the exchange view", async ({ page }) => {
  await page.getByLabel("Velg børs").selectOption({ label: "Oslo" });

  const row = eqnrRow(page);
  await expect(row).toBeVisible();

  const star = row.getByRole("button");
  await expect(star).toHaveText("☆");
  await expect(star).toHaveAttribute("title", "Legg til i favoritter");

  await star.click();
  await expect(star).toHaveText("★");
  await expect(star).toHaveAttribute("title", "Fjern fra favoritter");

  await star.click();
  await expect(star).toHaveText("☆");
  await expect(star).toHaveAttribute("title", "Legg til i favoritter");
});

test("the favorites tab is visitable and lists followed stocks", async ({ page }) => {
  const favoritesTab = page.getByRole("button", { name: "★ Favoritter" });

  // Nothing followed yet — the tab is reachable and shows the empty state.
  await favoritesTab.click();
  await expect(page.getByText(/Ingen favoritter/i)).toBeVisible();

  // Follow a stock from the exchange view, then confirm it shows up on the tab.
  await page.getByLabel("Velg børs").selectOption({ label: "Oslo" });
  await eqnrRow(page).getByRole("button").click();

  await favoritesTab.click();
  const favoritesRow = page.locator("tr.box-row", { hasText: "EQNR.OL" });
  await expect(favoritesRow).toBeVisible();
  await expect(page.getByText(/Ingen favoritter/i)).not.toBeVisible();

  // 1y/3y/5y trailing return columns are populated from the historical-returns endpoint.
  await expect(favoritesRow).toContainText("+12%");
  await expect(favoritesRow).toContainText("-4%");
  await expect(favoritesRow).toContainText("+30%");

  // Dividend yield and its YoY change are also populated from historical-returns.
  await expect(favoritesRow).toContainText("4.2%");
  await expect(favoritesRow).toContainText("+8%");
});

test("on a narrow viewport the favorites table scrolls horizontally with the stock name pinned", async ({ page }) => {
  await page.setViewportSize({ width: 380, height: 800 });

  await page.getByLabel("Velg børs").selectOption({ label: "Oslo" });
  await eqnrRow(page).getByRole("button").click();
  await page.getByRole("button", { name: "★ Favoritter" }).click();

  const wrap = page.locator(".favorites-table").locator("..");
  const nameCell = page.locator(".favorites-table .box-col-stock", { hasText: "EQNR.OL" });
  await expect(nameCell).toBeVisible();

  // With utbytte columns added there are more columns than fit a phone screen,
  // so the wrapper must overflow and require horizontal scrolling.
  const { scrollWidth, clientWidth } = await wrap.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
  }));
  expect(scrollWidth).toBeGreaterThan(clientWidth);

  // Scroll partway, then scroll further — once a sticky column has clamped
  // to the scrollport edge, additional scrolling shouldn't move it any more.
  await wrap.evaluate((el) => el.scrollBy({ left: 200 }));
  const xAtFirstScroll = (await nameCell.boundingBox())!.x;
  await wrap.evaluate((el) => el.scrollBy({ left: 200 }));
  const xAtSecondScroll = (await nameCell.boundingBox())!.x;

  expect(xAtSecondScroll).toBeCloseTo(xAtFirstScroll, 0);
});
