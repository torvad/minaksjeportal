import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Favorites from './Favorites';
import { FavoritesProvider, FavoriteStock } from '../context/FavoritesContext';

const STORAGE_KEY = 'minaksjeportal:favorites';

const EQNR_QUOTE = { symbol: 'EQNR.OL', name: 'Equinor', price: 300, change: 1.5, changePercent: 0.5, volume: 12345, previousClose: 298.5 };
const EQNR_RETURNS = { symbol: 'EQNR.OL', oneYear: 12.3, threeYear: -4.5, fiveYear: 30, dividendYield: 4.2, dividendChangePercent: 8 };

function seedFavorites(favs: FavoriteStock[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

function renderFavorites() {
  return render(
    <FavoritesProvider>
      <Favorites />
    </FavoritesProvider>
  );
}

/** Mocks global.fetch, routing quotes-by-symbols and historical-returns requests separately. */
function mockFetch(opts: { quotes?: any[]; returns?: any[]; quotesOk?: boolean; returnsOk?: boolean; reject?: boolean } = {}) {
  const { quotes = [], returns = [], quotesOk = true, returnsOk = true, reject = false } = opts;
  global.fetch = vi.fn().mockImplementation((url: string) => {
    if (reject) return Promise.reject(new Error('Network error'));
    if (url.includes('/api/yahoo/historical-returns')) {
      return Promise.resolve({ ok: returnsOk, json: async () => ({ returns }) });
    }
    if (url.includes('/api/yahoo/quotes-by-symbols')) {
      return Promise.resolve({ ok: quotesOk, json: async () => ({ quotes }) });
    }
    return Promise.reject(new Error(`Unexpected fetch URL: ${url}`));
  });
}

describe('Favorites', () => {
  beforeEach(() => {
    window.localStorage.clear();
    global.fetch = vi.fn();
  });

  it('shows an empty-state message and does not fetch when there are no favorites', () => {
    renderFavorites();

    expect(screen.getByText(/Ingen favoritter/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches quotes and historical returns for followed symbols and renders them', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    mockFetch({ quotes: [EQNR_QUOTE], returns: [EQNR_RETURNS] });

    renderFavorites();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/yahoo/historical-returns?symbols=EQNR.OL')
      );
    });

    expect(await screen.findByText('EQNR.OL')).toBeInTheDocument();
    expect(screen.getByText('300.00')).toBeInTheDocument();
    expect(screen.getByText('+12%')).toBeInTheDocument();
    expect(screen.getByText('-4%')).toBeInTheDocument();
    expect(screen.getByText('+30%')).toBeInTheDocument();
    expect(screen.getByText('4.2%')).toBeInTheDocument();
    expect(screen.getByText('+8%')).toBeInTheDocument();
  });

  it('shows a dash for periods with no historical data', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    mockFetch({ quotes: [EQNR_QUOTE], returns: [{ symbol: 'EQNR.OL', oneYear: 5, threeYear: null, fiveYear: null, dividendYield: null, dividendChangePercent: null }] });

    renderFavorites();

    expect(await screen.findByText('+5%')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(4);
  });

  it('still renders quotes when the historical-returns request fails', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    mockFetch({ quotes: [EQNR_QUOTE], returnsOk: false });

    renderFavorites();

    expect(await screen.findByText('EQNR.OL')).toBeInTheDocument();
    expect(screen.getAllByText('—')).toHaveLength(5);
  });

  it('joins multiple favorite symbols with a comma in the request URL', async () => {
    seedFavorites([
      { symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' },
      { symbol: 'DNB.OL', name: 'DNB Bank', exchange: 'OSL' },
    ]);
    mockFetch();

    renderFavorites();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('quotes-by-symbols?symbols=EQNR.OL%2CDNB.OL')
      );
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('historical-returns?symbols=EQNR.OL%2CDNB.OL')
      );
    });
  });

  it('shows an error message when the fetch fails', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    mockFetch({ reject: true });

    renderFavorites();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });

  it('removes a stock from the list and shows the empty state when its star is unfollowed', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    mockFetch({ quotes: [EQNR_QUOTE], returns: [EQNR_RETURNS] });

    renderFavorites();
    expect(await screen.findByText('EQNR.OL')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTitle('Fjern fra favoritter'));

    expect(await screen.findByText(/Ingen favoritter/i)).toBeInTheDocument();
  });
});
