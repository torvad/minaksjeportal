import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FavoritesProvider, useFavorites } from './FavoritesContext';

const STORAGE_KEY = 'minaksjeportal:favorites';

function TestConsumer() {
  const { favorites, isFavorite, toggleFavorite, removeFavorite } = useFavorites();
  return (
    <div>
      <ul>
        {favorites.map(f => (
          <li key={f.symbol}>{f.symbol}</li>
        ))}
      </ul>
      <span data-testid="is-eqnr-fav">{isFavorite('EQNR.OL') ? 'yes' : 'no'}</span>
      <button onClick={() => toggleFavorite({ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' })}>
        toggle-eqnr
      </button>
      <button onClick={() => removeFavorite('EQNR.OL')}>remove-eqnr</button>
    </div>
  );
}

function renderConsumer() {
  return render(
    <FavoritesProvider>
      <TestConsumer />
    </FavoritesProvider>
  );
}

describe('FavoritesContext', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty when localStorage has no saved favorites', () => {
    renderConsumer();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.getByTestId('is-eqnr-fav')).toHaveTextContent('no');
  });

  it('loads previously saved favorites from localStorage on mount', () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ symbol: 'DNB.OL', name: 'DNB Bank', exchange: 'OSL' }])
    );

    renderConsumer();

    expect(screen.getByText('DNB.OL')).toBeInTheDocument();
  });

  it('ignores corrupted localStorage content and starts empty', () => {
    window.localStorage.setItem(STORAGE_KEY, '{not valid json');

    renderConsumer();

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('toggleFavorite adds a stock that is not yet followed', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByText('toggle-eqnr'));

    expect(screen.getByText('EQNR.OL')).toBeInTheDocument();
    expect(screen.getByTestId('is-eqnr-fav')).toHaveTextContent('yes');
  });

  it('toggleFavorite removes a stock that is already followed', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByText('toggle-eqnr'));
    expect(screen.getByText('EQNR.OL')).toBeInTheDocument();

    await user.click(screen.getByText('toggle-eqnr'));
    expect(screen.queryByText('EQNR.OL')).not.toBeInTheDocument();
    expect(screen.getByTestId('is-eqnr-fav')).toHaveTextContent('no');
  });

  it('removeFavorite removes a stock by symbol', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByText('toggle-eqnr'));
    expect(screen.getByText('EQNR.OL')).toBeInTheDocument();

    await user.click(screen.getByText('remove-eqnr'));
    expect(screen.queryByText('EQNR.OL')).not.toBeInTheDocument();
  });

  it('persists favorites to localStorage after a change', async () => {
    const user = userEvent.setup();
    renderConsumer();

    await user.click(screen.getByText('toggle-eqnr'));

    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(saved).toEqual([{ symbol: 'EQNR.OL', name: 'Equinor', exchange: 'OSL' }]);
  });

  it('throws when useFavorites is used outside a FavoritesProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<TestConsumer />)).toThrow(
      'useFavorites must be used within a FavoritesProvider'
    );

    consoleError.mockRestore();
  });
});
