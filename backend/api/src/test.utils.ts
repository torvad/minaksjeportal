/**
 * Test utilities for API testing
 */

export interface MockResponse<T = any> {
  ok: boolean;
  status: number;
  json: () => Promise<T>;
  text: () => Promise<string>;
}

export function createMockResponse<T = any>(
  data: T,
  status: number = 200
): MockResponse<T> {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Mock data generators
 */

export const mockQuotes = [
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 150.25,
    change: 2.5,
    changePercent: 1.69,
    volume: 50000000,
    previousClose: 147.75,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 380.5,
    change: 5.0,
    changePercent: 1.33,
    volume: 20000000,
    previousClose: 375.5,
  },
];

export const mockScreenerResults = [
  {
    symbol: 'AAPL',
    name: 'Apple',
    score: 85,
    pe: 28.5,
    roe: 0.95,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft',
    score: 82,
    pe: 35.2,
    roe: 0.42,
  },
];

export const mockErrorResponse = {
  error: 'Failed to fetch data',
};

/**
 * Exchange test utilities
 */

export const EXCHANGES = ['OSL', 'STO', 'CSE', 'HEL', 'ICE'] as const;
export type Exchange = (typeof EXCHANGES)[number];

export function isValidExchange(code: string): code is Exchange {
  return EXCHANGES.includes(code as Exchange);
}

/**
 * Screener type utilities
 */

export const SCREENER_TYPES = ['quality', 'growth', 'dividend'] as const;
export type ScreenerType = (typeof SCREENER_TYPES)[number];

export function isValidScreenerType(type: string): type is ScreenerType {
  return SCREENER_TYPES.includes(type as ScreenerType);
}

/**
 * Format testing utilities
 */

export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '—';
  return value.toFixed(decimals);
}

export function formatVolume(value: number): string {
  if (!value || isNaN(value)) return '—';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'k';
  return value.toString();
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('nb-NO', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Async test helpers
 */

export async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
  interval: number = 50
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await delay(interval);
  }
}

/**
 * API call helpers for testing
 */

export async function fetchWithMock<T = any>(
  url: string,
  mockFn: (url: string) => Promise<MockResponse<T>>
): Promise<T> {
  const response = await mockFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
