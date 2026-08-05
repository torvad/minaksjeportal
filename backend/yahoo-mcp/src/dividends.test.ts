import { describe, it, expect } from "vitest";
import { computeDividendMetrics, SECONDS_PER_DAY } from "./dividends.js";

const NOW = 1_700_000_000; // arbitrary fixed "latest" timestamp

function daysAgo(days: number): number {
  return NOW - days * SECONDS_PER_DAY;
}

describe("computeDividendMetrics", () => {
  it("returns null yield and change when there are no dividend events", () => {
    const result = computeDividendMetrics(undefined, 300, NOW);
    expect(result).toEqual({ dividendYield: null, dividendChangePercent: null });
  });

  it("computes trailing-12-month yield from the close price", () => {
    const dividends = {
      a: { amount: 5, date: daysAgo(30) },
      b: { amount: 5, date: daysAgo(200) },
    };
    const { dividendYield } = computeDividendMetrics(dividends, 200, NOW);
    // (5 + 5) / 200 * 100 = 5%
    expect(dividendYield).toBeCloseTo(5, 5);
  });

  it("returns null change when there is no prior-year dividend to compare against", () => {
    const dividends = { a: { amount: 10, date: daysAgo(30) } };
    const { dividendYield, dividendChangePercent } = computeDividendMetrics(dividends, 100, NOW);
    expect(dividendYield).toBeCloseTo(10, 5);
    expect(dividendChangePercent).toBeNull();
  });

  it("computes the YoY percentage change between the two trailing 12-month windows", () => {
    const dividends = {
      thisYear: { amount: 12, date: daysAgo(100) },
      lastYear: { amount: 10, date: daysAgo(460) },
    };
    const { dividendChangePercent } = computeDividendMetrics(dividends, 300, NOW);
    // (12 - 10) / 10 * 100 = 20%
    expect(dividendChangePercent).toBeCloseTo(20, 5);
  });

  it("computes a negative change when the dividend was cut", () => {
    const dividends = {
      thisYear: { amount: 5, date: daysAgo(50) },
      lastYear: { amount: 10, date: daysAgo(400) },
    };
    const { dividendChangePercent } = computeDividendMetrics(dividends, 300, NOW);
    expect(dividendChangePercent).toBeCloseTo(-50, 5);
  });

  it("ignores dividend events older than the two trailing 12-month windows", () => {
    const dividends = {
      thisYear: { amount: 10, date: daysAgo(50) },
      ancient: { amount: 999, date: daysAgo(900) },
    };
    const { dividendYield, dividendChangePercent } = computeDividendMetrics(dividends, 200, NOW);
    expect(dividendYield).toBeCloseTo(5, 5);
    expect(dividendChangePercent).toBeNull();
  });

  it("returns null yield when the close price is zero or unavailable", () => {
    const dividends = { a: { amount: 5, date: daysAgo(30) } };
    const { dividendYield } = computeDividendMetrics(dividends, 0, NOW);
    expect(dividendYield).toBeNull();
  });
});
