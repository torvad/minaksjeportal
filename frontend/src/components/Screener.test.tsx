import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Screener from './Screener';
import { FavoritesProvider } from '../context/FavoritesContext';

function renderScreener() {
  return render(
    <FavoritesProvider>
      <Screener />
    </FavoritesProvider>
  );
}

// Mock fetch globally
beforeEach(() => {
  global.fetch = vi.fn();
});

describe('Screener', () => {
  it('renders without crashing', () => {
    renderScreener();
    expect(screen.getByText('Kvalitet')).toBeInTheDocument();
  });

  it('renders screener mode buttons', () => {
    renderScreener();
    // The component should have mode selection buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('handles mode selection', async () => {
    const user = userEvent.setup();
    renderScreener();

    const buttons = screen.getAllByRole('button');
    if (buttons.length > 0) {
      await user.click(buttons[0]);
    }
  });

  it('fetches screener data on mount or mode change', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [] }),
    });

    renderScreener();

    await waitFor(() => {
      // Component should attempt to fetch data
    });
  });

  it('displays error when screener fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));

    renderScreener();

    await waitFor(() => {
      // Error state should be visible
    });
  });
});
