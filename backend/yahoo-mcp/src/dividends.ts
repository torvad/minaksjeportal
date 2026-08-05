export const SECONDS_PER_DAY = 24 * 60 * 60;

export interface DividendEvent {
  amount: number;
  date: number;
}

export interface DividendMetrics {
  dividendYield: number | null;
  dividendChangePercent: number | null;
}

// Sums dividend payouts over the trailing and prior 12-month windows so yield
// and its YoY change derive from the same raw payout data (avoids relying on
// Yahoo's inconsistent dividendYield field scaling across endpoints).
export function computeDividendMetrics(
  dividends: Record<string, DividendEvent> | undefined,
  latestClose: number,
  latestSec: number
): DividendMetrics {
  const events = Object.values(dividends ?? {});
  let trailing12mo = 0;
  let prior12mo = 0;
  for (const ev of events) {
    const age = latestSec - ev.date;
    if (age >= 0 && age < 365 * SECONDS_PER_DAY) trailing12mo += ev.amount;
    else if (age >= 365 * SECONDS_PER_DAY && age < 2 * 365 * SECONDS_PER_DAY) prior12mo += ev.amount;
  }
  const dividendYield = trailing12mo > 0 && latestClose > 0 ? (trailing12mo / latestClose) * 100 : null;
  const dividendChangePercent = prior12mo > 0 ? ((trailing12mo - prior12mo) / prior12mo) * 100 : null;
  return { dividendYield, dividendChangePercent };
}
