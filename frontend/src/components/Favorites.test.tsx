import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Favorites from './Favorites';
import { FavoritesProvider, FavoriteStock } from '../context/FavoritesContext';

const STORAGE_KEY = 'minaksjeportal:favorites';

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

  it('fetches quotes for followed symbols on mount and renders them', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quotes: [
          { symbol: 'EQNR.OL', name: 'Equinor', price: 300, change: 1.5, changePercent: 0.5, volume: 12345, previousClose: 298.5 },
        ],
      }),
    });

    renderFavorites();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/yahoo/quotes-by-symbols?symbols=EQNR.OL')
      );
    });

    expect(await screen.findByText('EQNR.OL')).toBeInTheDocument();
    expect(screen.getByText('300.00')).toBeInTheDocument();
  });

  it('joins multiple favorite symbols with a comma in the request URL', async () => {
    seedFavorites([
      { symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' },
      { symbol: 'DNB.OL', name: 'DNB Bank', exchange: 'OSL' },
    ]);
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ quotes: [] }) });

    renderFavorites();

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('symbols=EQNR.OL%2CDNB.OL')
      );
    });
  });

  it('shows an error message when the fetch fails', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    renderFavorites();

    expect(await screen.findByText('Network error')).toBeInTheDocument();
  });

  it('removes a stock from the list and shows the empty state when its star is unfollowed', async () => {
    seedFavorites([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quotes: [
          { symbol: 'EQNR.OL', name: 'Equinor', price: 300, change: 1.5, changePercent: 0.5, volume: 12345, previousClose: 298.5 },
        ],
      }),
    });

    renderFavorites();
    expect(await screen.findByText('EQNR.OL')).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByTitle('Fjern fra favoritter'));

    expect(await screen.findByText(/Ingen favoritter/i)).toBeInTheDocument();
  });
});
