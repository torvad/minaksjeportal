import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FavoritesProvider } from '../context/FavoritesContext';
import MoversDashboard from './MoversDashboard';

function renderDashboard() {
  return render(
    <FavoritesProvider>
      <MoversDashboard />
    </FavoritesProvider>
  );
}

function quote(overrides: Partial<Record<string, any>> = {}) {
  return {
    symbol: 'EQNR.OL',
    name: 'Equinor',
    price: 300,
    change: 1.5,
    changePercent: 0.5,
    volume: 12345,
    previousClose: 298.5,
    ...overrides,
  };
}

/** Mocks global.fetch, routing all-quotes (per exchange) and historical-returns (per symbol) separately. */
function mockFetch(opts: {
  quotesByExchange?: Record<string, any[]>;
  returnsBySymbol?: Record<string, any>;
  failExchanges?: string[];
} = {}) {
  const { quotesByExchange = {}, returnsBySymbol = {}, failExchanges = [] } = opts;
  global.fetch = vi.fn().mockImplementation((url: string) => {
    const parsed = new URL(url, 'http://localhost');
    if (parsed.pathname.includes('historical-returns')) {
      const symbols = (parsed.searchParams.get('symbols') ?? '').split(',').filter(Boolean);
      const returns = symbols.map(s => returnsBySymbol[s]).filter(Boolean);
      return Promise.resolve({ ok: true, json: async () => ({ returns }) });
    }
    if (parsed.pathname.includes('all-quotes')) {
      const exchange = parsed.searchParams.get('exchange') ?? '';
      if (failExchanges.includes(exchange)) return Promise.reject(new Error(`${exchange} unavailable`));
      return Promise.resolve({ ok: true, json: async () => ({ quotes: quotesByExchange[exchange] ?? [] }) });
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe('MoversDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('fetches quotes for every Nordic exchange and ranks gainers/losers across markets', async () => {
    mockFetch({
      quotesByExchange: {
        OSL: [quote({ symbol: 'EQNR.OL', name: 'Equinor', change: 8, changePercent: 8 })],
        STO: [quote({ symbol: 'VOLV-B.ST', name: 'Volvo', change: -6, changePercent: -6 })],
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/api/yahoo/historical-returns'));
    });
    for (const code of ['OSL', 'STO', 'CSE', 'HEL', 'ICE']) {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`exchange=${code}`));
    }

    // Both panels also carry a mobile tab switcher with matching button labels,
    // so scope to the (desktop-only) title span to avoid ambiguous matches.
    const gainersPanel = (await screen.findByText('Størst oppgang', { selector: '.mover-title' })).closest('.box')!;
    const losersPanel = screen.getByText('Størst nedgang', { selector: '.mover-title' }).closest('.box')!;

    // Both movers show up in each panel (too few stocks to fill 20 rows), but
    // the 8% gainer should be ranked above the -6% mover in "Størst oppgang"...
    const gainersText = gainersPanel.textContent ?? '';
    expect(gainersText.indexOf('EQNR.OL')).toBeLessThan(gainersText.indexOf('VOLV-B.ST'));

    // ...and the ranking flips in "Størst nedgang".
    const losersText = losersPanel.textContent ?? '';
    expect(losersText.indexOf('VOLV-B.ST')).toBeLessThan(losersText.indexOf('EQNR.OL'));
  });

  it('fetches 1y/3y/5y growth only for the symbols shown in the top/bottom lists, and renders them', async () => {
    mockFetch({
      quotesByExchange: {
        OSL: [quote({ symbol: 'EQNR.OL', name: 'Equinor', change: 8, changePercent: 8 })],
      },
      returnsBySymbol: {
        'EQNR.OL': { symbol: 'EQNR.OL', oneYear: 12.3, threeYear: -4.5, fiveYear: 30 },
      },
    });

    renderDashboard();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('symbols=EQNR.OL'));
    });

    const gainersPanel = (await screen.findByText('Størst oppgang', { selector: '.mover-title' })).closest('.box')!;
    expect(gainersPanel).toHaveTextContent('+12%');
    expect(gainersPanel).toHaveTextContent('-4%');
    expect(gainersPanel).toHaveTextContent('+30%');
  });

  it('shows an error banner naming every exchange when all requests fail', async () => {
    mockFetch({ failExchanges: ['OSL', 'STO', 'CSE', 'HEL', 'ICE'] });

    renderDashboard();

    const banners = await screen.findAllByText(/Klarte ikke hente data for:/);
    expect(banners).toHaveLength(2); // one per panel (gainers + losers)
    expect(banners[0]).toHaveTextContent('Oslo');
    expect(banners[0]).toHaveTextContent('Reykjavik');
  });

  it('still shows data from exchanges that succeeded when others fail', async () => {
    mockFetch({
      quotesByExchange: { OSL: [quote()] },
      failExchanges: ['STO', 'CSE', 'HEL', 'ICE'],
    });

    renderDashboard();

    expect(await screen.findAllByText('EQNR.OL')).toHaveLength(2); // shows in both gainers and losers when it's the only quote
    const banners = screen.getAllByText(/Klarte ikke hente data for:/);
    expect(banners[0]).toHaveTextContent('Stockholm');
    expect(banners[0]).not.toHaveTextContent('Oslo');
  });
});
