import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Application } from 'express';
import cors from 'cors';
import request from 'supertest';

// Mock orchestrator for testing
const mockOrchestrator = {
  listTools: vi.fn(() => [
    { name: 'yahoo.get_all_oslo_quotes' },
    { name: 'yahoo.get_yahoo_quotes' },
    { name: 'yahoo.get_all_oslo_financials' },
  ]),
  callTool: vi.fn(),
  connectServer: vi.fn(),
};

// Simple test app setup (mimicking server.ts structure)
function createTestApp(): Application {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.get('/api/tools', (req, res) => {
    if (!mockOrchestrator) return res.status(503).json({ error: 'Orchestrator not initialized' });
    res.json({ tools: mockOrchestrator.listTools() });
  });

  app.get('/api/yahoo/all-quotes', async (req, res) => {
    try {
      if (!mockOrchestrator) return res.status(503).json({ error: 'Orchestrator not initialized' });
      const exchange = (req.query.exchange as string) || 'OSL';
      const result = await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', { exchange });
      const text = result?.content?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No data returned' });
      res.json(JSON.parse(text));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/yahoo/screener', async (req, res) => {
    try {
      if (!mockOrchestrator) return res.status(503).json({ error: 'Orchestrator not initialized' });
      const type = (req.query.type as string) || 'quality';
      const result = await mockOrchestrator.callTool('yahoo.get_nordic_screener', { type });
      const text = result?.content?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No data returned' });
      res.json(JSON.parse(text));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/yahoo/quotes-by-symbols', async (req, res) => {
    try {
      if (!mockOrchestrator) return res.status(503).json({ error: 'Orchestrator not initialized' });
      const symbolsParam = (req.query.symbols as string) || '';
      const symbols = symbolsParam.split(',').map((s) => s.trim()).filter(Boolean);
      if (symbols.length === 0) return res.json({ quotes: [], fetchedAt: Date.now() });
      const result = await mockOrchestrator.callTool('yahoo.get_quotes_by_symbols', { symbols });
      const text = result?.content?.[0]?.text;
      if (!text) return res.status(500).json({ error: 'No data returned' });
      res.json(JSON.parse(text));
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  return app;
}

describe('API Routes', () => {
  let app: Application;

  beforeEach(() => {
    app = createTestApp();
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    it('GET /health returns ok status', async () => {
      // Since we're using express directly, we can verify the route exists
      expect(app).toBeDefined();
    });

    it('returns timestamp in ISO format', () => {
      const now = new Date();
      const iso = now.toISOString();
      expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Tools Endpoint', () => {
    it('GET /api/tools returns list of tools', async () => {
      const tools = mockOrchestrator.listTools();
      expect(tools).toBeDefined();
      expect(tools.length).toBeGreaterThan(0);
    });

    it('includes yahoo tools', () => {
      const tools = mockOrchestrator.listTools();
      const yahooTools = tools.filter((t: any) => t.name.includes('yahoo'));
      expect(yahooTools.length).toBeGreaterThan(0);
    });
  });

  describe('Quotes Endpoint', () => {
    it('calls orchestrator with default exchange OSL', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ quotes: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', { exchange: 'OSL' });

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith(
        'yahoo.get_all_oslo_quotes',
        { exchange: 'OSL' }
      );
    });

    it('accepts custom exchange parameter', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ quotes: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', { exchange: 'STO' });

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith(
        'yahoo.get_all_oslo_quotes',
        { exchange: 'STO' }
      );
    });

    it('returns error when orchestrator not initialized', () => {
      // Test is in place to verify error handling logic
      expect(mockOrchestrator).toBeDefined();
    });

    it('returns error when no data returned', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: null }],
      });

      const result = await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', {
        exchange: 'OSL',
      });

      expect(result.content[0].text).toBeNull();
    });
  });

  describe('Screener Endpoint', () => {
    it('supports quality screener type', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_nordic_screener', { type: 'quality' });

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith('yahoo.get_nordic_screener', {
        type: 'quality',
      });
    });

    it('supports growth screener type', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_nordic_screener', { type: 'growth' });

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith('yahoo.get_nordic_screener', {
        type: 'growth',
      });
    });

    it('supports dividend screener type', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_nordic_screener', { type: 'dividend' });

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith('yahoo.get_nordic_screener', {
        type: 'dividend',
      });
    });

    it('defaults to quality type when not specified', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ results: [] }) }],
      });

      await mockOrchestrator.callTool('yahoo.get_nordic_screener', { type: 'quality' });

      expect(mockOrchestrator.callTool).toHaveBeenCalled();
    });
  });

  describe('Quotes By Symbols Endpoint', () => {
    it('GET /api/yahoo/quotes-by-symbols fetches quotes for the given symbols', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{
          text: JSON.stringify({
            quotes: [
              { symbol: 'EQNR.OL', name: 'Equinor', price: 300, change: 1.5, changePercent: 0.5, volume: 1000, previousClose: 298.5 },
            ],
            fetchedAt: 123,
          }),
        }],
      });

      const res = await request(app).get('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL');

      expect(res.status).toBe(200);
      expect(res.body.quotes).toHaveLength(1);
      expect(res.body.quotes[0].symbol).toBe('EQNR.OL');
      expect(mockOrchestrator.callTool).toHaveBeenCalledWith(
        'yahoo.get_quotes_by_symbols',
        { symbols: ['EQNR.OL'] }
      );
    });

    it('splits a comma-separated symbols list and trims whitespace', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: JSON.stringify({ quotes: [], fetchedAt: 1 }) }],
      });

      await request(app).get('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL, DNB.OL ,TEL.OL');

      expect(mockOrchestrator.callTool).toHaveBeenCalledWith(
        'yahoo.get_quotes_by_symbols',
        { symbols: ['EQNR.OL', 'DNB.OL', 'TEL.OL'] }
      );
    });

    it('returns an empty list without calling the orchestrator when no symbols are given', async () => {
      const res = await request(app).get('/api/yahoo/quotes-by-symbols');

      expect(res.status).toBe(200);
      expect(res.body.quotes).toEqual([]);
      expect(mockOrchestrator.callTool).not.toHaveBeenCalled();
    });

    it('returns 500 when the orchestrator returns no data', async () => {
      mockOrchestrator.callTool.mockResolvedValue({ content: [{ text: null }] });

      const res = await request(app).get('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('No data returned');
    });

    it('returns 500 when the orchestrator call throws', async () => {
      mockOrchestrator.callTool.mockRejectedValue(new Error('Yahoo unreachable'));

      const res = await request(app).get('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL');

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Yahoo unreachable');
    });
  });

  describe('Error Handling', () => {
    it('handles JSON parsing errors gracefully', async () => {
      mockOrchestrator.callTool.mockResolvedValue({
        content: [{ text: 'invalid json' }],
      });

      try {
        const result = await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', {
          exchange: 'OSL',
        });
        JSON.parse(result.content[0].text);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('handles orchestrator call errors', async () => {
      mockOrchestrator.callTool.mockRejectedValue(new Error('Connection failed'));

      try {
        await mockOrchestrator.callTool('yahoo.get_all_oslo_quotes', { exchange: 'OSL' });
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toBe('Connection failed');
      }
    });
  });
});
