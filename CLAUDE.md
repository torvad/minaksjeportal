# Stock Orchestrator

## Project
Nordic stock market dashboard. React frontend → Express API (port 4001) → 3 MCP servers: stock, yahoo, fmp.
Exchanges: OSL (Oslo), STO (Stockholm), CSE (København), HEL (Helsinki), ICE (Reykjavik).

## Architecture
- yahoo-mcp owns all screener, financials, volume, valuation and yield data
- Session mutex in yahoo-mcp/src/index.ts prevents concurrent Yahoo Finance auth races
- Exchange fallback chain: primary code → alt codes → region-only → []
- Screener modes: quality, growth, dividend

## Key files
- api/src/server.ts — all REST routes
- yahoo-mcp/src/index.ts — Yahoo Finance session management and data fetching
- frontend/src/components/StockDashboard.tsx — tab and view state
- frontend/src/components/Screener.tsx — screener UI
- frontend/src/components/boxes.css — shared box/table styling

## Permissions
- Always allowed to edit any file in this project without asking
