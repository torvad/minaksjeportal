// Bypass corporate TLS inspection — must be set before any HTTPS connections
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const FMP_API_KEY = process.env.FMP_API_KEY ?? "";
const FMP_BASE = "https://financialmodelingprep.com/stable";

const OSLO_STOCKS = [
  { symbol: "EQNR.OL",  name: "Equinor",          sector: "Energy" },
  { symbol: "DNB.OL",   name: "DNB Bank",          sector: "Finance" },
  { symbol: "TEL.OL",   name: "Telenor",           sector: "Telecom" },
  { symbol: "NHY.OL",   name: "Norsk Hydro",       sector: "Materials" },
  { symbol: "AKRBP.OL", name: "Aker BP",           sector: "Energy" },
  { symbol: "MOWI.OL",  name: "Mowi",              sector: "Seafood" },
  { symbol: "ORK.OL",   name: "Orkla",             sector: "Consumer" },
  { symbol: "YAR.OL",   name: "Yara International", sector: "Materials" },
  { symbol: "SALM.OL",  name: "SalMar",            sector: "Seafood" },
  { symbol: "SUBC.OL",  name: "Subsea 7",          sector: "Energy Services" }
];

const HEADERS = { "Accept": "application/json" };
const SYMBOLS = OSLO_STOCKS.map(s => s.symbol).join(",");

function checkPremiumError(data: any): void {
  if (typeof data === "string" && data.includes("Premium")) {
    throw new Error("FMP plan does not cover Oslo Børs — upgrade to a paid plan at financialmodelingprep.com");
  }
  if (Array.isArray(data) && data.length > 0 && typeof data[0] === "string" && data[0].includes("Premium")) {
    throw new Error("FMP plan does not cover Oslo Børs — upgrade to a paid plan at financialmodelingprep.com");
  }
}

function checkStatus(res: Response, label: string): void {
  if (res.status === 402) throw new Error("FMP free plan dekker ikke Oslo Børs — krever betalt abonnement (financialmodelingprep.com)");
  if (!res.ok) throw new Error(`FMP ${label} feil: HTTP ${res.status}`);
}

// Batch quotes: price, change, changePercentage, volume, previousClose
async function fetchBatchQuotes(): Promise<Map<string, any>> {
  const res = await fetch(`${FMP_BASE}/quote?symbol=${SYMBOLS}&apikey=${FMP_API_KEY}`, { headers: HEADERS });
  checkStatus(res, "quote");
  const data = await res.json() as any;
  checkPremiumError(data);
  const arr = Array.isArray(data) ? data : [];
  const map = new Map<string, any>();
  for (const q of arr) map.set(q.symbol, q);
  return map;
}

// Batch profiles: companyName, sector, lastDividend, price
async function fetchBatchProfiles(): Promise<Map<string, any>> {
  const res = await fetch(`${FMP_BASE}/profile?symbol=${SYMBOLS}&apikey=${FMP_API_KEY}`, { headers: HEADERS });
  checkStatus(res, "profile");
  const data = await res.json() as any;
  checkPremiumError(data);
  const arr = Array.isArray(data) ? data : [];
  const map = new Map<string, any>();
  for (const p of arr) map.set(p.symbol, p);
  return map;
}

// Per-stock ratios-ttm in parallel: priceToEarningsRatioTTM, priceToBookRatioTTM, etc.
async function fetchAllRatiosTTM(): Promise<Map<string, any>> {
  const results = await Promise.all(
    OSLO_STOCKS.map(async s => {
      const res = await fetch(`${FMP_BASE}/ratios-ttm?symbol=${s.symbol}&apikey=${FMP_API_KEY}`, { headers: HEADERS });
      if (!res.ok) return { symbol: s.symbol, data: null };
      const json = await res.json() as any;
      if (typeof json === "string" && json.includes("Premium")) return { symbol: s.symbol, data: null };
      const arr = Array.isArray(json) ? json : [];
      return { symbol: s.symbol, data: arr[0] ?? null };
    })
  );
  const map = new Map<string, any>();
  for (const r of results) if (r.data) map.set(r.symbol, r.data);
  return map;
}

const server = new Server(
  { name: "fmp-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_fmp_quotes",
      description: "Fetches real-time batch stock quotes from Financial Modeling Prep for all Oslo Børs stocks.",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "get_top_yields",
      description: "Returns Oslo Børs equities ranked by dividend yield (highest first), sourced from Financial Modeling Prep.",
      inputSchema: {
        type: "object",
        properties: { count: { type: "number", description: "Number of stocks to return (default 10)" } },
        required: []
      }
    },
    {
      name: "get_top_pe",
      description: "Returns Oslo Børs equities ranked by P/E ratio (highest first), sourced from Financial Modeling Prep.",
      inputSchema: {
        type: "object",
        properties: { count: { type: "number", description: "Number of stocks to return (default 10)" } },
        required: []
      }
    },
    {
      name: "get_top_pb",
      description: "Returns Oslo Børs equities ranked by P/B ratio (highest first), sourced from Financial Modeling Prep.",
      inputSchema: {
        type: "object",
        properties: { count: { type: "number", description: "Number of stocks to return (default 10)" } },
        required: []
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const count = (args as any)?.count ?? 10;

  if (name === "get_fmp_quotes") {
    const [quotes, profiles] = await Promise.all([fetchBatchQuotes(), fetchBatchProfiles()]);
    const result = OSLO_STOCKS.map(s => {
      const q = quotes.get(s.symbol);
      const p = profiles.get(s.symbol);
      if (!q && !p) return null;
      return {
        symbol: s.symbol,
        name: p?.companyName ?? q?.name ?? s.name,
        sector: p?.sector ?? s.sector,
        price: q?.price ?? p?.price ?? 0,
        change: q?.change ?? p?.change ?? 0,
        changePercent: q?.changePercentage ?? p?.changePercentage ?? 0,
        volume: q?.volume ?? p?.volume ?? 0,
        previousClose: q?.previousClose ?? 0,
        latestTradingDay: q?.timestamp
          ? new Date((q.timestamp as number) * 1000).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      };
    }).filter((s): s is NonNullable<typeof s> => s !== null && s.price > 0);

    return {
      content: [{ type: "text", text: JSON.stringify({ quotes: result, source: "fmp", fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_yields") {
    const [profiles, quotes] = await Promise.all([fetchBatchProfiles(), fetchBatchQuotes()]);
    const stocks = OSLO_STOCKS
      .map(s => {
        const p = profiles.get(s.symbol);
        const q = quotes.get(s.symbol);
        const price = q?.price ?? p?.price ?? 0;
        const lastDiv = p?.lastDividend ?? 0;
        if (!price || !lastDiv || lastDiv <= 0) return null;
        return {
          symbol: s.symbol,
          name: p?.companyName ?? q?.name ?? s.name,
          dividendYield: (lastDiv / price) * 100,
          trailingAnnualDividendRate: lastDiv,
          price,
          change: q?.change ?? 0,
          changePercent: q?.changePercentage ?? 0
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.dividendYield - a.dividendYield)
      .slice(0, count)
      .map((s, i) => ({ rank: i + 1, ...s }));

    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, source: "fmp", fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_pe") {
    const [quotes, ratios] = await Promise.all([fetchBatchQuotes(), fetchAllRatiosTTM()]);
    const stocks = OSLO_STOCKS
      .map(s => {
        const q = quotes.get(s.symbol);
        const r = ratios.get(s.symbol);
        const pe = r?.priceToEarningsRatioTTM ?? null;
        if (!pe || pe <= 0) return null;
        return {
          symbol: s.symbol,
          name: q?.name ?? s.name,
          peRatio: pe,
          epsTrailingTwelveMonths: r?.netIncomePerShareTTM ?? 0,
          price: q?.price ?? 0,
          changePercent: q?.changePercentage ?? 0
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.peRatio - a.peRatio)
      .slice(0, count)
      .map((s, i) => ({ rank: i + 1, ...s }));

    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, source: "fmp", fetchedAt: Date.now() }, null, 2) }]
    };
  }

  if (name === "get_top_pb") {
    const [quotes, ratios] = await Promise.all([fetchBatchQuotes(), fetchAllRatiosTTM()]);
    const stocks = OSLO_STOCKS
      .map(s => {
        const q = quotes.get(s.symbol);
        const r = ratios.get(s.symbol);
        const pb = r?.priceToBookRatioTTM ?? null;
        if (!pb || pb <= 0) return null;
        return {
          symbol: s.symbol,
          name: q?.name ?? s.name,
          pbRatio: pb,
          bookValuePerShare: r?.bookValuePerShareTTM ?? 0,
          price: q?.price ?? 0,
          changePercent: q?.changePercentage ?? 0
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => b.pbRatio - a.pbRatio)
      .slice(0, count)
      .map((s, i) => ({ rank: i + 1, ...s }));

    return {
      content: [{ type: "text", text: JSON.stringify({ stocks, source: "fmp", fetchedAt: Date.now() }, null, 2) }]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("fmp-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
