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

const EQNR_RETURNS = { symbol: "EQNR.OL", oneYear: 12.3, threeYear: -4.5, fiveYear: 30 };

async function mockApi(page: Page) {
  await page.route("**/api/yahoo/all-quotes**", (route) =>
    route.fulfill({ json: { quotes: [EQNR_QUOTE], fetchedAt: Date.now() } })
  );
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
  await page.getByRole("button", { name: "Oslo" }).click();
  await eqnrRow(page).getByRole("button").click();

  await favoritesTab.click();
  const favoritesRow = page.locator("tr.box-row", { hasText: "EQNR.OL" });
  await expect(favoritesRow).toBeVisible();
  await expect(page.getByText(/Ingen favoritter/i)).not.toBeVisible();

  // 1y/3y/5y trailing return columns are populated from the historical-returns endpoint.
  await expect(favoritesRow).toContainText("+12.3%");
  await expect(favoritesRow).toContainText("-4.5%");
  await expect(favoritesRow).toContainText("+30.0%");
});
