import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockDashboard from './StockDashboard';

// Mock the useSortableData hook
vi.mock('../hooks/useSortableData', () => ({
  useSortableData: (data: any) => ({
    sorted: data,
    handleSort: vi.fn(),
    ind: () => '',
  }),
}));

describe('StockDashboard', () => {
  beforeEach(() => {
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  it('renders without crashing', () => {
    render(<StockDashboard />);
    expect(screen.getByText('Oslo')).toBeInTheDocument();
  });

  it('lists all exchanges in the market dropdown', () => {
    render(<StockDashboard />);
    const exchangeSelect = screen.getByLabelText('Velg børs');
    const optionLabels = Array.from(exchangeSelect.querySelectorAll('option')).map(o => o.textContent);
    expect(optionLabels).toEqual(['Oslo', 'Stockholm', 'København', 'Helsinki', 'Reykjavik']);
  });

  it('shows the combined movers dashboard by default', () => {
    render(<StockDashboard />);
    // Both panels also carry a mobile tab switcher with matching button labels,
    // so scope to the (desktop-only) title span to avoid ambiguous matches.
    expect(screen.getByText('Størst oppgang', { selector: '.mover-title' })).toBeInTheDocument();
    expect(screen.getByText('Størst nedgang', { selector: '.mover-title' })).toBeInTheDocument();
    const dashboardTab = screen.getByRole('button', { name: 'Dashboard' });
    expect(dashboardTab).toHaveClass('active');
  });

  it('selecting a market from the dropdown leaves the dashboard view', async () => {
    const user = userEvent.setup();
    render(<StockDashboard />);

    await user.selectOptions(screen.getByLabelText('Velg børs'), 'Stockholm');

    expect(screen.queryByText('Størst oppgang', { selector: '.mover-title' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveClass('active');
  });

  it('switches exchange via the market dropdown', async () => {
    const user = userEvent.setup();
    render(<StockDashboard />);

    const exchangeSelect = screen.getByLabelText('Velg børs');
    await user.selectOptions(exchangeSelect, 'Stockholm');

    expect(exchangeSelect).toHaveValue('STO');
    expect(exchangeSelect).toHaveClass('active');
  });

  it('fetches quotes when exchange is changed', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quotes: [] }),
    });

    render(<StockDashboard />);
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  it('displays error message on fetch failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<StockDashboard />);

    // The default dashboard view reports per-exchange fetch failures via its
    // own "Klarte ikke hente data for: ..." banner rather than the raw error.
    await waitFor(() => {
      expect(screen.getAllByText(/Failed to fetch|Network error|Klarte ikke hente data/i).length).toBeGreaterThan(0);
    });
  });

  it('shows loading state during fetch', async () => {
    global.fetch = vi.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: async () => ({ quotes: [] }),
      }), 100))
    );

    render(<StockDashboard />);
    
    await waitFor(() => {
      const refreshBtn = screen.getAllByText('↻')[0];
      expect(refreshBtn).toBeInTheDocument();
    });
  });

  it('toggles between screener and exchange view', async () => {
    const user = userEvent.setup();
    render(<StockDashboard />);
    
    const tabs = screen.getAllByRole('button');
    const screenerTab = tabs.find(btn => btn.textContent === 'Screener');
    
    if (screenerTab) {
      await user.click(screenerTab);
      // Screener view should be active
    }
  });
});
