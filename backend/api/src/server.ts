import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { Orchestrator } from "./orchestrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
const app = express();
const PORT = process.env.PORT || 4001;

let orchestrator: Orchestrator | null = null;

// This is a public, read-only data proxy with no accounts or cookies, so an
// open CORS policy carries none of the session-theft/CSRF risk it would on
// an authenticated app — the only reason to scope it is to stop random third
// parties from freely using this server as their own Yahoo Finance proxy.
const ALLOWED_ORIGINS = [
  "https://minaksjeportal.com",
  "http://localhost:5173",
  "http://localhost:4173",
];
app.use(cors({ origin: ALLOWED_ORIGINS }));

// CSP is left to the frontend's own hosting (Cloudflare Pages) — this Express
// instance only serves frontend/dist locally in dev, and helmet's default CSP
// would need real testing against that build to avoid breaking it.
app.use(helmet({ contentSecurityPolicy: false }));

// Generous but real ceiling: protects against scraping/abuse of the free,
// unauthenticated Yahoo Finance proxy without getting in the way of normal
// dashboard usage (several panels can each fire a request on load/refresh).
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

app.use(express.json());

app.use(express.static(path.join(__dirname, "../../../frontend/dist")));

const VALID_EXCHANGES = new Set(["OSL", "STO", "CSE", "HEL", "ICE"]);
const VALID_SCREENER_TYPES = new Set(["quality", "growth", "dividend"]);

function parseExchange(req: Request): string {
  const exchange = (req.query.exchange as string) || "OSL";
  return VALID_EXCHANGES.has(exchange) ? exchange : "OSL";
}

function parseScreenerType(req: Request): string {
  const type = (req.query.type as string) || "quality";
  return VALID_SCREENER_TYPES.has(type) ? type : "quality";
}

// Logs the real error server-side but never echoes error.message to the
// client — internal details (stack traces, upstream error text) have no
// reason to be public on an unauthenticated API.
function handleError(res: Response, label: string, error: unknown) {
  console.error(`${label}:`, error);
  res.status(500).json({ error: "Internal server error" });
}

async function initOrchestrator() {
  try {
    orchestrator = new Orchestrator();

    console.log("Connecting to yahoo-mcp...");
    await orchestrator.connectServer(
      "yahoo",
      "tsx",
      [path.join(__dirname, "../../yahoo-mcp/src/index.ts")]
    );

    console.log("✓ All MCP servers connected");
  } catch (error) {
    console.warn("MCP servers unavailable:", error instanceof Error ? error.message : error);
    orchestrator = null;
  }
}

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/tools", (_req: Request, res: Response) => {
  if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
  res.json({ tools: orchestrator.listTools() });
});


app.get("/api/yahoo/all-quotes", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = parseExchange(req);
    const result = await orchestrator.callTool("yahoo.get_all_oslo_quotes", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "All quotes error", error);
  }
});

app.get("/api/yahoo/quotes", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_yahoo_quotes", {});
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Yahoo quotes error", error);
  }
});

app.get("/api/yahoo/all-financials", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = parseExchange(req);
    const result = await orchestrator.callTool("yahoo.get_all_oslo_financials", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Financials error", error);
  }
});

app.get("/api/yahoo/all-volume", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = parseExchange(req);
    const result = await orchestrator.callTool("yahoo.get_all_oslo_volume", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Volume error", error);
  }
});

app.get("/api/yahoo/all-valuation", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = parseExchange(req);
    const result = await orchestrator.callTool("yahoo.get_all_oslo_valuation", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Valuation error", error);
  }
});

app.get("/api/yahoo/top-volume", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_top_volume", { count: 15 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Top volume error", error);
  }
});

app.get("/api/yahoo/top-yields", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_top_yields", { count: 10 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Top dividends error", error);
  }
});


app.get("/api/yahoo/top-pe", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_top_pe", { count: 10 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Top PE error", error);
  }
});

app.get("/api/yahoo/top-ps", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_top_ps", { count: 10 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Top PS error", error);
  }
});

app.get("/api/yahoo/fx", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_fx_rates", {});
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "FX rates error", error);
  }
});

app.get("/api/yahoo/quotes-by-symbols", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const symbolsParam = (req.query.symbols as string) || "";
    const symbols = symbolsParam.split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9.-]{1,15}$/.test(s));
    if (symbols.length === 0) return res.json({ quotes: [], fetchedAt: Date.now() });
    const result = await orchestrator.callTool("yahoo.get_quotes_by_symbols", { symbols });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Quotes by symbols error", error);
  }
});

app.get("/api/yahoo/historical-returns", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const symbolsParam = (req.query.symbols as string) || "";
    const symbols = symbolsParam.split(",").map(s => s.trim()).filter(s => /^[A-Za-z0-9.-]{1,15}$/.test(s));
    if (symbols.length === 0) return res.json({ returns: [], fetchedAt: Date.now() });
    const result = await orchestrator.callTool("yahoo.get_historical_returns", { symbols });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Historical returns error", error);
  }
});

app.get("/api/yahoo/screener", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const type = parseScreenerType(req);
    const result = await orchestrator.callTool("yahoo.get_nordic_screener", { type });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Screener error", error);
  }
});

app.get("/api/yahoo/top-pb", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("yahoo.get_top_pb", { count: 10 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    handleError(res, "Top PB error", error);
  }
});

app.get("*", (_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

async function startServer() {
  await initOrchestrator();
  app.listen(PORT, () => {
    console.log(`\n✓ API server running on http://localhost:${PORT}`);
    console.log(`  - Yahoo quotes: GET http://localhost:${PORT}/api/yahoo/quotes`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
