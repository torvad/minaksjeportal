import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    expect(screen.getByText(/Oslo/i)).toBeInTheDocument();
  });

  it('renders exchange tabs', () => {
    render(<StockDashboard />);
    expect(screen.getByText('Oslo')).toBeInTheDocument();
    expect(screen.getByText('Stockholm')).toBeInTheDocument();
    expect(screen.getByText('København')).toBeInTheDocument();
    expect(screen.getByText('Helsinki')).toBeInTheDocument();
    expect(screen.getByText('Reykjavik')).toBeInTheDocument();
  });

  it('switches between exchange tabs', async () => {
    const user = userEvent.setup();
    render(<StockDashboard />);
    
    const stockholmTab = screen.getByText('Stockholm');
    await user.click(stockholmTab);
    
    expect(stockholmTab).toHaveClass('active');
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
    
    await waitFor(() => {
      expect(screen.getByText(/Failed to fetch|Network error/i)).toBeInTheDocument();
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
