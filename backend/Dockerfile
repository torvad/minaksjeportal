FROM node:20-alpine

WORKDIR /app

# tsx runs TypeScript source directly — needed for MCP child processes spawned by the API
RUN npm install -g tsx

# Install production deps for each service (layered for Docker cache efficiency)
COPY api/package.json ./api/
RUN cd api && npm install --omit=dev

COPY yahoo-mcp/package.json ./yahoo-mcp/
RUN cd yahoo-mcp && npm install --omit=dev

# Copy source after deps so code changes don't bust the dep cache
COPY api/ ./api/
COPY yahoo-mcp/ ./yahoo-mcp/

EXPOSE 4001

CMD ["tsx", "api/src/server.ts"]
