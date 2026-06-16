import dotenv from "dotenv";
import express, { Request, Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { Orchestrator } from "./orchestrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
const app = express();
const PORT = process.env.PORT || 4001;

let orchestrator: Orchestrator | null = null;

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, "../../frontend/dist")));

async function initOrchestrator() {
  try {
    orchestrator = new Orchestrator();

    console.log("Connecting to stock-mcp...");
    await orchestrator.connectServer(
      "stock",
      "tsx",
      [path.join(__dirname, "../../stock-mcp/src/index.ts")]
    );

    console.log("Connecting to yahoo-mcp...");
    await orchestrator.connectServer(
      "yahoo",
      "tsx",
      [path.join(__dirname, "../../yahoo-mcp/src/index.ts")]
    );

    console.log("Connecting to fmp-mcp...");
    await orchestrator.connectServer(
      "fmp",
      "tsx",
      [path.join(__dirname, "../../fmp-mcp/src/index.ts")]
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

app.post("/api/stocks", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: "Missing symbol" });
    const result = await orchestrator.callTool("stock.get_stock_quote", { symbol });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/oslo-stocks", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("stock.list_oslo_stocks", {});
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/yahoo/all-quotes", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = (req.query.exchange as string) || "OSL";
    const result = await orchestrator.callTool("yahoo.get_all_oslo_quotes", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("All quotes error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Yahoo quotes error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/yahoo/all-financials", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = (req.query.exchange as string) || "OSL";
    const result = await orchestrator.callTool("yahoo.get_all_oslo_financials", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Financials error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/yahoo/all-volume", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = (req.query.exchange as string) || "OSL";
    const result = await orchestrator.callTool("yahoo.get_all_oslo_volume", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Volume error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/yahoo/all-valuation", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const exchange = (req.query.exchange as string) || "OSL";
    const result = await orchestrator.callTool("yahoo.get_all_oslo_valuation", { exchange });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Valuation error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Top volume error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Top dividends error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/fmp/quotes", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("fmp.get_fmp_quotes", {});
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("FMP quotes error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/fmp/top-yields", async (_req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const result = await orchestrator.callTool("fmp.get_top_yields", { count: 10 });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("FMP top yields error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Top PE error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Top PS error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
});

app.get("/api/yahoo/screener", async (req: Request, res: Response) => {
  try {
    if (!orchestrator) return res.status(503).json({ error: "Orchestrator not initialized" });
    const type = (req.query.type as string) || "quality";
    const result = await orchestrator.callTool("yahoo.get_nordic_screener", { type });
    const text = result.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: "No data returned" });
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Screener error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
    console.error("Top PB error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
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
