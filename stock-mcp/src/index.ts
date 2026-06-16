import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY ?? "";

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

const server = new Server(
  { name: "stock-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_stock_quote",
        description: "Fetches a real-time stock quote from Alpha Vantage for a given ticker symbol.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The stock ticker symbol, e.g. EQNR.OL"
            }
          },
          required: ["symbol"]
        }
      },
      {
        name: "list_oslo_stocks",
        description: "Returns a hardcoded list of Oslo Børs (Oslo Stock Exchange) tickers with company names and sectors.",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "list_oslo_stocks") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(OSLO_STOCKS, null, 2)
        }
      ]
    };
  }

  if (name === "get_stock_quote") {
    const symbol = (args as { symbol: string }).symbol;

    if (!symbol) {
      throw new Error("Missing required parameter: symbol");
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage API returned ${response.status}`);
    }

    const data = await response.json() as Record<string, any>;

    // Handle rate limit responses
    if (data["Note"] || data["Information"]) {
      const message = data["Note"] || data["Information"];
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              error: "rate_limited",
              message,
              symbol
            })
          }
        ]
      };
    }

    const quote = data["Global Quote"];
    if (!quote || Object.keys(quote).length === 0) {
      throw new Error(`No quote data returned for symbol: ${symbol}`);
    }

    const parsed = {
      symbol: quote["01. symbol"],
      price: parseFloat(quote["05. price"]),
      open: parseFloat(quote["02. open"]),
      high: parseFloat(quote["03. high"]),
      low: parseFloat(quote["04. low"]),
      volume: parseInt(quote["06. volume"], 10),
      change: parseFloat(quote["09. change"]),
      changePercent: parseFloat(quote["10. change percent"]?.replace("%", "")),
      previousClose: parseFloat(quote["08. previous close"]),
      latestTradingDay: quote["07. latest trading day"]
    };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parsed, null, 2)
        }
      ]
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("stock-mcp server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
