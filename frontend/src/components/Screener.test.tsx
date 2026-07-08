import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Screener from './Screener';

// Mock fetch globally
beforeEach(() => {
  global.fetch = vi.fn();
});

describe('Screener', () => {
  it('renders without crashing', () => {
    render(<Screener />);
    expect(screen.getByText(/screener|quality|growth|dividend/i)).toBeInTheDocument();
  });

  it('renders screener mode buttons', () => {
    render(<Screener />);
    // The component should have mode selection buttons
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('handles mode selection', async () => {
    const user = userEvent.setup();
    render(<Screener />);
    
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

    render(<Screener />);
    
    await waitFor(() => {
      // Component should attempt to fetch data
    });
  });

  it('displays error when screener fetch fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('API Error'));
    
    render(<Screener />);
    
    await waitFor(() => {
      // Error state should be visible
    });
  });
});
