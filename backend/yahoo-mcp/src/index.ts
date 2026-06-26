// Bypass corporate TLS inspection — must be set before any HTTPS connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const OSLO_STOCKS = [
  { symbol: "EQNR.OL", name: "Equinor", sector: "Energy" },
  { symbol: "DNB.OL", name: "DNB Bank", sector: "Finance" },
  { symbol: "TEL.OL", name: "Telenor", sector: "Telecom" },
  { symbol: "NHY.OL", name: "Norsk Hydro", sector: "Materials" },
  { symbol: "AKRBP.OL", name: "Aker BP", sector: "Energy" },
  { symbol: "MOWI.OL", name: "Mowi", sector: "Seafood" },
  { symbol: "ORK.OL", name: "Orkla", sector: "Consumer" },
  { symbol: "YAR.OL", name: "Yara International", sector: "Materials" },
  { symbol: "SALM.OL", name: "SalMar", sector: "Seafood" },
  { symbol: "SUBC.OL", name: "Subsea 7", sector: "Energy Services" }
];

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const EXCHANGE_REGION: Record<string, string> = {
  OSL: "NO",
  STO: "SE",
  CSE: "DK",
  HEL: "FI",
  ICE: "IS",
};

// Alternate screener exchange codes to try if the primary code fails
const EXCHANGE_FALLBACK_CODES: Record<string, string[]> = {
  STO: ["NGM"],
  CSE: ["CPH", "XCSE"],
  HEL: ["XHEL"],
  ICE: ["XICE", "ICX"],
};

// Cached Yahoo Finance session credentials
let sessionCookie = "";
let sessionCrumb = "";
let sessionRefreshPromise: Promise<void> | null = null;

async function refreshSession(): Promise<void> {
  // Deduplicate concurrent refresh calls — all waiters share one refresh
  if (sessionRefreshPromise) return sessionRefreshPromise;
  sessionRefreshPromise = _doRefreshSession().finally(() => { sessionRefreshPromise = null; });
  return sessionRefreshPromise;
}

// Yahoo sometimes returns 200 with an HTML consent/captcha page. Treat that as auth failure.
async function safeJson(res: globalThis.Response): Promise<Record<string, any>> {
  const text = await res.text();
  if (text.trimStart().startsWith('<')) {
    sessionCrumb = "";
    sessionCookie = "";
    throw new Error(`Yahoo returned HTML instead of JSON (status ${res.status}) — session blocked or consent required`);
  }
  return JSON.parse(text) as Record<string, any>;
}

async function _doRefreshSession(): Promise<void> {
  // Step 1: obtain a session cookie from Yahoo consent endpoint
  const sessRes = await fetch("https://fc.yahoo.com", {
    redirect: "manual",
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  // Collect all Set-Cookie headers
  const setCookie = sessRes.headers.getSetCookie?.() ?? [];
  sessionCookie = setCookie.map(c => c.split(";")[0]).join("; ");

  // Step 2: get the CSRF crumb
  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": BROWSER_UA,
      "Cookie": sessionCookie,
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });
  if (!crumbRes.ok) throw new Error(`Crumb request failed: ${crumbRes.status}`);
  sessionCrumb = await crumbRes.text();
  console.error(`yahoo-mcp: session refreshed, crumb=${sessionCrumb.slice(0, 8)}...`);
}

async function fetchYahooQuotes(): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const symbols = OSLO_STOCKS.map(s => s.symbol).join(",");
  const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${encodeURIComponent(sessionCrumb)}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Cookie": sessionCookie,
      "Accept": "application/json, */*",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  // If 401, session expired — refresh once and retry
  if (res.status === 401) {
    await refreshSession();
    const retry = await fetch(
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&crumb=${encodeURIComponent(sessionCrumb)}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          "Cookie": sessionCookie,
          "Accept": "application/json, */*"
        }
      }
    );
    if (!retry.ok) throw new Error(`Yahoo Finance ${retry.status} after session refresh`);
    const data = await safeJson(retry);
    return data?.quoteResponse?.result ?? [];
  }

  if (!res.ok) throw new Error(`Yahoo Finance returned ${res.status}: ${res.statusText}`);
  const data = await safeJson(res);
  return data?.quoteResponse?.result ?? [];
}

const server = new Server(
  { name: "yahoo-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

async function fetchTopVolume(count = 15, exchange = "OSL"): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const region = EXCHANGE_REGION[exchange] ?? "NO";

  const makeBody = (includeExchange: boolean) => ({
    offset: 0,
    size: 100,
    sortField: "dayvolume",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        ...(includeExchange ? [{ operator: "EQ", operands: ["exchange", exchange] }] : []),
        { operator: "GT", operands: ["intradaymarketcap", 100_000_000] }
      ]
    },
    userId: "",
    userIdType: "guid"
  });

  const doFetch = async (body: object, crumb: string, cookie: string) =>
    fetch(`https://query2.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=${region}&crumb=${encodeURIComponent(crumb)}`, {
      method: "POST",
      headers: { "User-Agent": BROWSER_UA, "Cookie": cookie, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    });

  let res = await doFetch(makeBody(true), sessionCrumb, sessionCookie);
  if (res.status === 401) { await refreshSession(); res = await doFetch(makeBody(true), sessionCrumb, sessionCookie); }

  if (!res.ok) {
    console.error(`[volume screener] exchange=${exchange} HTTP ${res.status} — retrying region-only`);
    res = await doFetch(makeBody(false), sessionCrumb, sessionCookie);
    if (res.status === 401) { await refreshSession(); res = await doFetch(makeBody(false), sessionCrumb, sessionCookie); }
  }

  if (!res.ok) {
    console.error(`[volume screener] region=${region} also failed: ${res.status}`);
    return [];
  }

  const data = await safeJson(res);
  const quotes: any[] = data?.finance?.result?.[0]?.quotes ?? [];

  return quotes
    .map(q => ({ ...q, _turnover: (q.regularMarketPrice ?? 0) * (q.regularMarketVolume ?? 0) }))
    .sort((a, b) => b._turnover - a._turnover)
    .slice(0, count);
}

async function fetchTopYields(count = 10, exchange = "OSL"): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const region = EXCHANGE_REGION[exchange] ?? "NO";

  const makeBody = (includeExchange: boolean) => ({
    offset: 0,
    size: count,
    sortField: "dividendyield",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        ...(includeExchange ? [{ operator: "EQ", operands: ["exchange", exchange] }] : []),
        { operator: "GT", operands: ["intradaymarketcap", 1_000_000_000] },
        { operator: "GT", operands: ["dividendyield", 0] }
      ]
    },
    userId: "",
    userIdType: "guid"
  });

  const doFetch = async (body: object, crumb: string, cookie: string) =>
    fetch(`https://query2.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=${region}&crumb=${encodeURIComponent(crumb)}`, {
      method: "POST",
      headers: { "User-Agent": BROWSER_UA, "Cookie": cookie, "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body)
    });

  let res = await doFetch(makeBody(true), sessionCrumb, sessionCookie);
  if (res.status === 401) { await refreshSession(); res = await doFetch(makeBody(true), sessionCrumb, sessionCookie); }

  if (!res.ok) {
    console.error(`[yield screener] exchange=${exchange} HTTP ${res.status} — retrying region-only`);
    res = await doFetch(makeBody(false), sessionCrumb, sessionCookie);
    if (res.status === 401) { await refreshSession(); res = await doFetch(makeBody(false), sessionCrumb, sessionCookie); }
  }

  if (!res.ok) {
    console.error(`[yield screener] region=${region} also failed: ${res.status}`);
    return [];
  }

  const data = await safeJson(res);
  return data?.finance?.result?.[0]?.quotes ?? [];
}

// Fetch Oslo Børs stocks sorted by market cap; trailingPE and priceToBook are
// fields in each quote — we sort by them server-side because the screener's peratio/
// pricetobook sort fields don't work for the OSL exchange.
// Uses a low market-cap floor so small-cap stocks with extreme P/E or P/B are included.
async function fetchLargeCapStocks(exchange = "OSL"): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const region = EXCHANGE_REGION[exchange] ?? "NO";

  const makeBody = (exchangeCode: string | null) => ({
    offset: 0,
    size: 200,
    sortField: "intradaymarketcap",
    sortType: "DESC",
    quoteType: "EQUITY",
    query: {
      operator: "AND",
      operands: [
        ...(exchangeCode ? [{ operator: "EQ", operands: ["exchange", exchangeCode] }] : []),
        { operator: "GT", operands: ["intradaymarketcap", 10_000_000] }
      ]
    },
    userId: "",
    userIdType: "guid"
  });

  const screenerUrl = `https://query2.finance.yahoo.com/v1/finance/screener?formatted=false&lang=en-US&region=${region}&crumb=`;

  const doFetch = async (exchangeCode: string | null) => {
    const body = JSON.stringify(makeBody(exchangeCode));
    let res = await fetch(screenerUrl + encodeURIComponent(sessionCrumb), {
      method: "POST",
      headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Content-Type": "application/json", "Accept": "application/json" },
      body
    });
    if (res.status === 401) {
      await refreshSession();
      res = await fetch(screenerUrl + encodeURIComponent(sessionCrumb), {
        method: "POST",
        headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Content-Type": "application/json", "Accept": "application/json" },
        body
      });
    }
    if (!res.ok) return null;
    const data = await safeJson(res);
    return (data?.finance?.result?.[0]?.quotes ?? []) as any[];
  };

  // Try primary exchange code, then fallbacks, then region-only
  const codesToTry: Array<string | null> = [
    exchange,
    ...(EXCHANGE_FALLBACK_CODES[exchange] ?? []),
    null  // region-only as last resort
  ];

  for (const code of codesToTry) {
    const label = code ?? `region=${region}`;
    const quotes = await doFetch(code);
    if (quotes === null) {
      console.error(`[screener] ${exchange}→${label}: HTTP error`);
      continue;
    }
    if (quotes.length > 0) return quotes;
    console.error(`[screener] ${exchange}→${label}: 0 results`);
  }

  return [];
}

async function fetchOsloFinancials(limit = 40, exchange = "OSL"): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const screened = await fetchLargeCapStocks(exchange);
  const symbols = screened.slice(0, limit).map((q: any) => q.symbol as string);

  const fetchOne = async (symbol: string) => {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData&formatted=false&crumb=${encodeURIComponent(sessionCrumb)}`;
    try {
      let r = await fetch(url, {
        headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Accept": "application/json" }
      });
      if (r.status === 401) {
        await refreshSession();
        const retryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData&formatted=false&crumb=${encodeURIComponent(sessionCrumb)}`;
        r = await fetch(retryUrl, {
          headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Accept": "application/json" }
        });
      }
      if (!r.ok) return null;
      const d = await safeJson(r);
      const fd = d?.quoteSummary?.result?.[0]?.financialData;
      if (!fd) return null;
      const raw = screened.find((q: any) => q.symbol === symbol);
      return {
        symbol,
        name: (raw?.longName as string | undefined) ?? (raw?.shortName as string | undefined) ?? symbol,
        revenueGrowth: fd.revenueGrowth ?? null,
        earningsGrowth: fd.earningsGrowth ?? null,
        debtToEquity: fd.debtToEquity ?? null,
        totalDebt: fd.totalDebt ?? null,
      };
    } catch {
      return null;
    }
  };

  const results = await Promise.all(symbols.map(fetchOne));
  return results.filter(Boolean);
}

const NORDIC_EXCHANGES = ["OSL", "STO", "CSE", "HEL", "ICE"];

type ScreenerType = "quality" | "growth" | "dividend";

async function fetchNordicScreener(type: ScreenerType = "quality"): Promise<any[]> {
  if (!sessionCrumb) await refreshSession();

  const perExchange = await Promise.all(
    NORDIC_EXCHANGES.map(ex =>
      fetchLargeCapStocks(ex).then(stocks =>
        stocks.slice(0, 30).map((q: any) => ({ ...q, _exchange: ex }))
      ).catch(() => [])
    )
  );
  const candidates = perExchange.flat();

  const fetchOne = async (q: any) => {
    const symbol = q.symbol as string;
    const modules = "financialData%2CdefaultKeyStatistics%2CsummaryDetail";
    const mkUrl = () => `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=${modules}&formatted=false&crumb=${encodeURIComponent(sessionCrumb)}`;
    try {
      let r = await fetch(mkUrl(), { headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Accept": "application/json" } });
      if (r.status === 401) { await refreshSession(); r = await fetch(mkUrl(), { headers: { "User-Agent": BROWSER_UA, "Cookie": sessionCookie, "Accept": "application/json" } }); }
      if (!r.ok) return null;
      const d = await safeJson(r);
      const fd  = d?.quoteSummary?.result?.[0]?.financialData;
      const ks  = d?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      const sd  = d?.quoteSummary?.result?.[0]?.summaryDetail;
      if (!fd) return null;

      const revenueGrowth: number | null = fd.revenueGrowth ?? null;
      const earningsGrowth: number | null = fd.earningsGrowth ?? null;
      const returnOnEquity: number | null = fd.returnOnEquity ?? null;
      const totalDebt: number | null = fd.totalDebt ?? null;
      const ebitda: number | null = fd.ebitda ?? null;
      const freeCashflow: number | null = fd.freeCashflow ?? null;
      const netIncome: number | null =
        ks?.netIncomeToCommon ??
        (fd.profitMargins != null && fd.totalRevenue != null ? fd.profitMargins * fd.totalRevenue : null);
      const peRatio: number | null = (q.trailingPE as number | undefined) ?? ks?.trailingPE ?? sd?.trailingPE ?? null;
      // summaryDetail is the authoritative source for dividend fields
      const dividendYield: number | null =
        sd?.trailingAnnualDividendYield ??
        sd?.dividendYield ??
        (q.trailingAnnualDividendYield as number | undefined) ??
        (q.dividendYield as number | undefined) ?? null;
      const payoutRatio: number | null = sd?.payoutRatio ?? ks?.payoutRatio ?? null;
      const debtToEbitda: number | null = (totalDebt !== null && ebitda !== null && ebitda > 0) ? totalDebt / ebitda : null;

      let passes = false;
      if (type === "quality") {
        passes =
          revenueGrowth !== null && revenueGrowth > 0.03 &&
          netIncome !== null && netIncome > 0 &&
          peRatio !== null && peRatio >= 5 && peRatio <= 40 &&
          debtToEbitda !== null && debtToEbitda < 5 &&
          returnOnEquity !== null && returnOnEquity > 0.08;
      } else if (type === "growth") {
        passes =
          revenueGrowth !== null && revenueGrowth > 0.08 &&
          (earningsGrowth === null || earningsGrowth > 0.08) &&
          peRatio !== null && peRatio < 50 &&
          returnOnEquity !== null && returnOnEquity > 0.10 &&
          (debtToEbitda === null || debtToEbitda < 4);
      } else if (type === "dividend") {
        const dy = dividendYield ?? 0;
        console.error(`[div] ${symbol}: yield=${dy.toFixed(4)} payout=${payoutRatio?.toFixed(2) ?? "null"} pe=${peRatio?.toFixed(1)} fcf=${freeCashflow} roe=${returnOnEquity?.toFixed(3)} d/e=${debtToEbitda?.toFixed(2)}`);
        passes =
          dy > 0.03 &&
          (payoutRatio === null || payoutRatio < 0.80) &&
          peRatio !== null && peRatio >= 5 && peRatio <= 35 &&
          (freeCashflow === null || freeCashflow > 0) &&
          returnOnEquity !== null && returnOnEquity > 0.08 &&
          (debtToEbitda === null || debtToEbitda < 4);
      }

      if (!passes) return null;

      return {
        symbol,
        exchange: q._exchange,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? symbol,
        price: (q.regularMarketPrice as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0,
        peRatio,
        revenueGrowth,
        earningsGrowth,
        returnOnEquity,
        debtToEbitda,
        netIncome,
        dividendYield,
        payoutRatio,
        freeCashflow,
      };
    } catch {
      return null;
    }
  };

  const results = await Promise.all(candidates.map(fetchOne));
  const passed = results.filter(Boolean);
  console.error(`[screener:${type}] ${candidates.length} candidates → ${passed.length} passed`);
  return passed;
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_yahoo_quotes",
      description: "Fetches real-time batch stock quotes from Yahoo Finance for all Oslo Børs stocks.",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_top_volume",
      description: "Returns the top Oslo Børs equities by day volume today, using the Yahoo Finance screener.",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of stocks to return (default 15)" }
        },
        required: []
      }
    },
    {
      name: "get_top_yields",
      description: "Returns the top Oslo Børs equities by dividend yield, using the Yahoo Finance screener.",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of stocks to return (default 10)" }
        },
        required: []
      }
    },
    {
      name: "get_top_pe",
      description: "Returns the top Oslo Børs equities by P/E ratio (price-to-earnings), using the Yahoo Finance screener.",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of stocks to return (default 10)" }
        },
        required: []
      }
    },
    {
      name: "get_top_pb",
      description: "Returns the top Oslo Børs equities by P/B ratio (price-to-book), using the Yahoo Finance screener.",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of stocks to return (default 10)" }
        },
        required: []
      }
    },
    {
      name: "get_all_oslo_quotes",
      description: "Returns all equities for a given exchange with current price, change, and volume.",
      inputSchema: { type: "object", properties: { exchange: { type: "string", description: "Exchange code e.g. OSL, STO, CSE" } }, required: [] }
    },
    {
      name: "get_all_oslo_financials",
      description: "Returns revenue growth, earnings growth, debt-to-equity and total debt for top stocks on a given exchange.",
      inputSchema: { type: "object", properties: { exchange: { type: "string", description: "Exchange code e.g. OSL, STO, CSE" } }, required: [] }
    },
    {
      name: "get_all_oslo_volume",
      description: "Returns all equities on a given exchange sorted by turnover (price × volume).",
      inputSchema: { type: "object", properties: { exchange: { type: "string", description: "Exchange code e.g. OSL, STO, CSE" } }, required: [] }
    },
    {
      name: "get_all_oslo_valuation",
      description: "Returns all equities on a given exchange with P/E, P/B, and dividend yield.",
      inputSchema: { type: "object", properties: { exchange: { type: "string", description: "Exchange code e.g. OSL, STO, CSE" } }, required: [] }
    },
    {
      name: "get_top_ps",
      description: "Returns the top Oslo Børs equities by P/S ratio (price-to-sales), using the Yahoo Finance screener.",
      inputSchema: {
        type: "object",
        properties: {
          count: { type: "number", description: "Number of stocks to return (default 10)" }
        },
        required: []
      }
    },
    {
      name: "get_nordic_screener",
      description: "Screens all Nordic exchanges. type: 'quality' (default), 'growth', or 'dividend'.",
      inputSchema: { type: "object", properties: { type: { type: "string", description: "quality | growth | dividend" } }, required: [] }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "get_top_volume") {
    const count = (args as any)?.count ?? 15;
    const raw = await fetchTopVolume(count);
    const stocks = raw.map((q: any, i: number) => {
      const price = (q.regularMarketPrice as number) ?? 0;
      const volume = (q.regularMarketVolume as number) ?? 0;
      return {
        rank: i + 1,
        symbol: q.symbol as string,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        volume,
        turnover: price * volume,
        price,
        change: (q.regularMarketChange as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0,
      };
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_yahoo_quotes") {
    const results = await fetchYahooQuotes();

    const quotes = results.map((q: any) => {
      const stock = OSLO_STOCKS.find(s => s.symbol === q.symbol);
      return {
        symbol: q.symbol,
        name: stock?.name ?? (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        sector: stock?.sector ?? "",
        price: (q.regularMarketPrice as number) ?? 0,
        change: (q.regularMarketChange as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0,
        volume: (q.regularMarketVolume as number) ?? 0,
        previousClose: (q.regularMarketPreviousClose as number) ?? 0,
        latestTradingDay: q.regularMarketTime
          ? new Date((q.regularMarketTime as number) * 1000).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      };
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({ quotes, source: "yahoo-finance", fetchedAt: Date.now() }, null, 2)
      }]
    };
  }

  if (name === "get_top_yields") {
    const count = (args as any)?.count ?? 10;
    const raw = await fetchTopYields(count);
    const stocks = raw.map((q: any, i: number) => ({
      rank: i + 1,
      symbol: q.symbol as string,
      name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
      dividendYield: (q.dividendYield as number) ?? 0,
      trailingAnnualDividendRate: (q.trailingAnnualDividendRate as number) ?? 0,
      price: (q.regularMarketPrice as number) ?? 0,
      change: (q.regularMarketChange as number) ?? 0,
      changePercent: (q.regularMarketChangePercent as number) ?? 0
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_pe") {
    const count = (args as any)?.count ?? 10;
    const all = await fetchLargeCapStocks();
    const stocks = all
      .filter((q: any) => q.trailingPE > 0)
      .sort((a: any, b: any) => b.trailingPE - a.trailingPE)
      .slice(0, count)
      .map((q: any, i: number) => ({
        rank: i + 1,
        symbol: q.symbol as string,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        peRatio: q.trailingPE as number,
        epsTrailingTwelveMonths: (q.epsTrailingTwelveMonths as number) ?? 0,
        price: (q.regularMarketPrice as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_pb") {
    const count = (args as any)?.count ?? 10;
    const all = await fetchLargeCapStocks();
    const stocks = all
      .filter((q: any) => q.priceToBook > 0)
      .sort((a: any, b: any) => b.priceToBook - a.priceToBook)
      .slice(0, count)
      .map((q: any, i: number) => ({
        rank: i + 1,
        symbol: q.symbol as string,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        pbRatio: q.priceToBook as number,
        bookValuePerShare: (q.bookValue as number) ?? 0,
        price: (q.regularMarketPrice as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_ps") {
    const count = (args as any)?.count ?? 10;

    // Screener result doesn't carry priceToSalesTrailing12Months — get symbols from
    // screener then re-fetch via the quote endpoint which does include it.
    const screened = await fetchLargeCapStocks();
    console.error(`[PS] screener returned ${screened.length} stocks`);

    // Chunk into batches of 100 to stay within URL length limits
    const allSymbols = screened.map((q: any) => q.symbol as string);
    const chunks: string[][] = [];
    for (let i = 0; i < allSymbols.length; i += 100) chunks.push(allSymbols.slice(i, i + 100));

    const doQuoteFetch = async (syms: string, crumb: string, cookie: string) =>
      fetch(`https://query2.finance.yahoo.com/v7/finance/quote?symbols=${syms}&crumb=${encodeURIComponent(crumb)}`, {
        headers: { "User-Agent": BROWSER_UA, "Cookie": cookie, "Accept": "application/json" }
      });

    const quotes: any[] = [];
    for (const chunk of chunks) {
      const syms = chunk.join(",");
      let qRes = await doQuoteFetch(syms, sessionCrumb, sessionCookie);
      if (qRes.status === 401) { await refreshSession(); qRes = await doQuoteFetch(syms, sessionCrumb, sessionCookie); }
      if (!qRes.ok) { console.error(`[PS] quote fetch ${qRes.status}`); continue; }
      const qData = await safeJson(qRes);
      quotes.push(...(qData?.quoteResponse?.result ?? []));
    }

    console.error(`[PS] got ${quotes.length} quotes; sample keys: ${quotes[0] ? Object.keys(quotes[0]).filter(k => k.toLowerCase().includes("sale") || k.toLowerCase().includes("revenue")).join(", ") : "none"}`);

    const withPS = quotes.filter((q: any) => q.priceToSalesTrailing12Months > 0);
    console.error(`[PS] ${withPS.length} quotes have priceToSalesTrailing12Months > 0`);

    const stocks = withPS
      .sort((a: any, b: any) => b.priceToSalesTrailing12Months - a.priceToSalesTrailing12Months)
      .slice(0, count)
      .map((q: any, i: number) => ({
        rank: i + 1,
        symbol: q.symbol as string,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        psRatio: q.priceToSalesTrailing12Months as number,
        revenuePerShare: (q.revenuePerShare as number) ?? 0,
        price: (q.regularMarketPrice as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0
      }));
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_all_oslo_financials") {
    const exchange = (args as any)?.exchange ?? "OSL";
    const stocks = await fetchOsloFinancials(40, exchange);
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_all_oslo_volume") {
    const exchange = (args as any)?.exchange ?? "OSL";
    const raw = await fetchLargeCapStocks(exchange);
    const stocks = raw
      .map((q: any) => ({
        symbol: q.symbol as string,
        name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
        price: (q.regularMarketPrice as number) ?? 0,
        volume: (q.regularMarketVolume as number) ?? 0,
        turnover: ((q.regularMarketPrice as number) ?? 0) * ((q.regularMarketVolume as number) ?? 0),
        change: (q.regularMarketChange as number) ?? 0,
        changePercent: (q.regularMarketChangePercent as number) ?? 0,
      }))
      .sort((a: any, b: any) => b.turnover - a.turnover);
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_all_oslo_valuation") {
    const exchange = (args as any)?.exchange ?? "OSL";
    const raw = await fetchLargeCapStocks(exchange);
    const stocks = raw.map((q: any) => ({
      symbol: q.symbol as string,
      name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
      peRatio: (q.trailingPE as number | undefined) ?? null,
      pbRatio: (q.priceToBook as number | undefined) ?? null,
      dividendYield: (q.dividendYield as number | undefined) ?? null,
      changePercent: (q.regularMarketChangePercent as number) ?? 0,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_all_oslo_quotes") {
    const exchange = (args as any)?.exchange ?? "OSL";
    const raw = await fetchLargeCapStocks(exchange);
    const quotes = raw.map((q: any) => ({
      symbol: q.symbol as string,
      name: (q.longName as string | undefined) ?? (q.shortName as string | undefined) ?? q.symbol,
      price: (q.regularMarketPrice as number) ?? 0,
      change: (q.regularMarketChange as number) ?? 0,
      changePercent: (q.regularMarketChangePercent as number) ?? 0,
      volume: (q.regularMarketVolume as number) ?? 0,
      previousClose: (q.regularMarketPreviousClose as number) ?? 0,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify({ quotes, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_nordic_screener") {
    const screenerType = ((args as any)?.type ?? "quality") as ScreenerType;
    const stocks = await fetchNordicScreener(screenerType);
    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, fetchedAt: Date.now() }, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("yahoo-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
