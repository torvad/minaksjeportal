# Stock Orchestrator

## Project
Nordic stock market dashboard. React frontend → Express API (port 4001) → 3 MCP servers: stock, yahoo, fmp.
Exchanges: OSL (Oslo), STO (Stockholm), CSE (København), HEL (Helsinki), ICE (Reykjavik).

## Architecture
- yahoo-mcp owns all screener, financials, volume, valuation and yield data
- Session mutex in backend/yahoo-mcp/src/index.ts prevents concurrent Yahoo Finance auth races
- Exchange fallback chain: primary code → alt codes → region-only → []
- Screener modes: quality, growth, dividend

## Key files
- backend/api/src/server.ts — all REST routes
- backend/yahoo-mcp/src/index.ts — Yahoo Finance session management and data fetching
- frontend/src/components/StockDashboard.tsx — tab and view state
- frontend/src/components/Screener.tsx — screener UI
- frontend/src/components/boxes.css — shared box/table styling

## Permissions
- Always allowed to edit any file in this project without asking

## Workflow
- When asked to "deploy" the app, also commit and push the changes to GitHub (origin/main) as part of the same request — don't wait for a separate ask.
- Run the test suite (frontend + backend) before deploying.

## Traffic and quotas
Most traffic is crawlers, and every uncached API call is a slow upstream Yahoo request.
- backend/api/src/server.ts caches successful GET /api/yahoo/* JSON responses in memory for 5 minutes, keyed by full URL. New Yahoo routes get this automatically; keep the TTL short since prices must stay fresh.
- frontend/public/robots.txt blocks known AI/scraper bots, /api/ and every URL with a query string (/*?).
- The rate limiter (60 req/min per IP on /api/) stays as the last line of defence.
- After every change, without asking: run tests, commit, push origin/main and deploy — backend with `flyctl deploy` (only if backend changed), frontend with `wrangler deploy`.
