import { test, expect, Page } from "@playwright/test";

const EXCHANGE_QUOTES: Record<string, any[]> = {
  OSL: [{ symbol: "EQNR.OL", name: "Equinor", price: 300, change: 24, changePercent: 8.7, volume: 12345, previousClose: 276 }],
  STO: [{ symbol: "VOLV-B.ST", name: "Volvo", price: 180, change: -12, changePercent: -6.3, volume: 5000, previousClose: 192 }],
  CSE: [],
  HEL: [],
  ICE: [],
};

const RETURNS_BY_SYMBOL: Record<string, any> = {
  "EQNR.OL": { symbol: "EQNR.OL", oneYear: 12.3, threeYear: -4.5, fiveYear: 30 },
  "VOLV-B.ST": { symbol: "VOLV-B.ST", oneYear: -8.1, threeYear: 15, fiveYear: 40 },
};

async function mockApi(page: Page) {
  await page.route("**/api/yahoo/all-quotes**", (route) => {
    const url = new URL(route.request().url());
    const exchange = url.searchParams.get("exchange") ?? "OSL";
    return route.fulfill({ json: { quotes: EXCHANGE_QUOTES[exchange] ?? [], fetchedAt: Date.now() } });
  });
  await page.route("**/api/yahoo/historical-returns**", (route) => {
    const url = new URL(route.request().url());
    const symbols = (url.searchParams.get("symbols") ?? "").split(",").filter(Boolean);
    const returns = symbols.map(s => RETURNS_BY_SYMBOL[s]).filter(Boolean);
    return route.fulfill({ json: { returns, fetchedAt: Date.now() } });
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
}

function panel(page: Page, title: string) {
  return page.locator(".box", { hasText: title });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
});

test("the Dashboard tab is the default view and shows movers from multiple markets", async ({ page }) => {
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveClass(/active/);
  await expect(page.getByText("Størst oppgang")).toBeVisible();
  await expect(page.getByText("Størst nedgang")).toBeVisible();

  const gainers = panel(page, "Størst oppgang");
  const losers = panel(page, "Størst nedgang");

  // Both mocked movers come from different exchanges but land in the same combined view.
  await expect(gainers.locator("tr.box-row", { hasText: "EQNR.OL" })).toBeVisible();
  await expect(gainers.locator("tr.box-row", { hasText: "VOLV-B.ST" })).toBeVisible();
  await expect(losers.locator("tr.box-row", { hasText: "EQNR.OL" })).toBeVisible();
  await expect(losers.locator("tr.box-row", { hasText: "VOLV-B.ST" })).toBeVisible();

  // The Oslo exchange badge should be visible on the Equinor row.
  await expect(gainers.locator("tr.box-row", { hasText: "EQNR.OL" }).getByText("OSL")).toBeVisible();

  // 1y/3y/5y growth columns are populated from the historical-returns endpoint.
  const equinorRow = gainers.locator("tr.box-row", { hasText: "EQNR.OL" });
  await expect(equinorRow).toContainText("+12%");
  await expect(equinorRow).toContainText("-4%");
  await expect(equinorRow).toContainText("+30%");
});

test("picking a market from the dropdown switches away from the dashboard", async ({ page }) => {
  await page.getByLabel("Velg børs").selectOption({ label: "Stockholm" });

  await expect(page.getByText("Størst oppgang")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).not.toHaveClass(/active/);
  await expect(page.getByLabel("Velg børs")).toHaveClass(/active/);
});

test("returning to the Dashboard tab shows the movers view again", async ({ page }) => {
  await page.getByLabel("Velg børs").selectOption({ label: "Stockholm" });
  await page.getByRole("button", { name: "Dashboard" }).click();

  await expect(page.getByText("Størst oppgang")).toBeVisible();
  await expect(page.getByRole("button", { name: "Dashboard" })).toHaveClass(/active/);
});
