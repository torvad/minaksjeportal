/**
 * Test utilities for frontend component testing
 */
import { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';

/**
 * Custom render function for React components with common setup
 */
export function renderWithDefaults(
  component: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(component, { ...options });
}

/**
 * Mock data for stock quotes
 */
export const mockStockQuotes = [
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
    change: -5.0,
    changePercent: -1.3,
    volume: 20000000,
    previousClose: 385.5,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 140.0,
    change: 0,
    changePercent: 0,
    volume: 30000000,
    previousClose: 140.0,
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
  {
    symbol: 'GOOGL',
    name: 'Alphabet',
    score: 88,
    pe: 25.0,
    roe: 0.75,
  },
];

/**
 * Setup mock fetch for API calls
 */
export function setupMockFetch(responses: Record<string, any>) {
  return (url: string) => {
    const key = Object.keys(responses).find(
      k => url.includes(k) || url.endsWith(k)
    );
    const response = key ? responses[key] : null;

    if (response instanceof Error) {
      return Promise.reject(response);
    }

    return Promise.resolve({
      ok: true,
      json: async () => response || { data: [] },
    });
  };
}

/**
 * Format testing utilities
 */
export function testNumberFormat(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '—';
  return value.toFixed(decimals);
}

export function testVolumeFormat(value: number): string {
  if (!value || isNaN(value)) return '—';
  if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
  if (value >= 1_000) return (value / 1_000).toFixed(0) + 'k';
  return value.toString();
}

/**
 * Async test utilities
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * User event helpers
 */
export async function userClickElement(element: HTMLElement) {
  return new Promise(resolve => {
    element.click();
    resolve(undefined);
  });
}

/**
 * Exchange mock data
 */
export const mockExchanges = [
  { code: 'OSL', label: 'Oslo' },
  { code: 'STO', label: 'Stockholm' },
  { code: 'CSE', label: 'København' },
  { code: 'HEL', label: 'Helsinki' },
  { code: 'ICE', label: 'Reykjavik' },
];

/**
 * Screener mode constants
 */
export const screenerModes = {
  quality: { id: 'quality', label: 'Quality' },
  growth: { id: 'growth', label: 'Growth' },
  dividend: { id: 'dividend', label: 'Dividend' },
};

/**
 * Create test props for components
 */
export function createPanelProps(overrides = {}) {
  return {
    title: 'Test Panel',
    source: 'TEST',
    quotes: mockStockQuotes,
    loading: false,
    error: '',
    lastUpdated: new Date(),
    onRefresh: () => {},
    ...overrides,
  };
}
