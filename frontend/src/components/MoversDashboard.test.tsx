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

describe('MoversDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('fetches quotes for every Nordic exchange and ranks gainers/losers across markets', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const exchange = new URL(url, 'http://localhost').searchParams.get('exchange');
      const quotesByExchange: Record<string, any[]> = {
        OSL: [quote({ symbol: 'EQNR.OL', name: 'Equinor', change: 8, changePercent: 8 })],
        STO: [quote({ symbol: 'VOLV-B.ST', name: 'Volvo', change: -6, changePercent: -6 })],
        CSE: [],
        HEL: [],
        ICE: [],
      };
      return Promise.resolve({ ok: true, json: async () => ({ quotes: quotesByExchange[exchange ?? ''] ?? [] }) });
    });

    renderDashboard();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
    for (const code of ['OSL', 'STO', 'CSE', 'HEL', 'ICE']) {
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining(`exchange=${code}`));
    }

    const gainersPanel = (await screen.findByText('Størst oppgang')).closest('.box')!;
    const losersPanel = screen.getByText('Størst nedgang').closest('.box')!;

    // Both movers show up in each panel (too few stocks to fill 20 rows), but
    // the 8% gainer should be ranked above the -6% mover in "Størst oppgang"...
    const gainersText = gainersPanel.textContent ?? '';
    expect(gainersText.indexOf('EQNR.OL')).toBeLessThan(gainersText.indexOf('VOLV-B.ST'));

    // ...and the ranking flips in "Størst nedgang".
    const losersText = losersPanel.textContent ?? '';
    expect(losersText.indexOf('VOLV-B.ST')).toBeLessThan(losersText.indexOf('EQNR.OL'));
  });

  it('shows an error banner naming every exchange when all requests fail', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    renderDashboard();

    const banners = await screen.findAllByText(/Klarte ikke hente data for:/);
    expect(banners).toHaveLength(2); // one per panel (gainers + losers)
    expect(banners[0]).toHaveTextContent('Oslo');
    expect(banners[0]).toHaveTextContent('Reykjavik');
  });

  it('still shows data from exchanges that succeeded when others fail', async () => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      const exchange = new URL(url, 'http://localhost').searchParams.get('exchange');
      if (exchange !== 'OSL') return Promise.reject(new Error('unavailable'));
      return Promise.resolve({ ok: true, json: async () => ({ quotes: [quote()] }) });
    });

    renderDashboard();

    expect(await screen.findAllByText('EQNR.OL')).toHaveLength(2); // shows in both gainers and losers when it's the only quote
    const banners = screen.getAllByText(/Klarte ikke hente data for:/);
    expect(banners[0]).toHaveTextContent('Stockholm');
    expect(banners[0]).not.toHaveTextContent('Oslo');
  });
});
