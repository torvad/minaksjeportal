import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FavoriteStar from './FavoriteStar';
import { FavoritesProvider } from '../context/FavoritesContext';

function renderStar() {
  return render(
    <FavoritesProvider>
      <FavoriteStar symbol="EQNR.OL" name="Equinor" exchange="OSL" />
    </FavoritesProvider>
  );
}

describe('FavoriteStar', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders an inactive outline star when not followed', () => {
    renderStar();
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('☆');
    expect(btn).not.toHaveClass('active');
    expect(btn).toHaveAttribute('title', 'Legg til i favoritter');
  });

  it('becomes an active filled star after clicking', async () => {
    const user = userEvent.setup();
    renderStar();

    await user.click(screen.getByRole('button'));

    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('★');
    expect(btn).toHaveClass('active');
    expect(btn).toHaveAttribute('title', 'Fjern fra favoritter');
  });

  it('toggles back to inactive when clicked twice', async () => {
    const user = userEvent.setup();
    renderStar();

    const btn = screen.getByRole('button');
    await user.click(btn);
    await user.click(btn);

    expect(btn).toHaveTextContent('☆');
    expect(btn).not.toHaveClass('active');
  });

  it('does not propagate the click to a parent handler (e.g. a table row)', async () => {
    const user = userEvent.setup();
    let rowClicks = 0;

    render(
      <FavoritesProvider>
        <div onClick={() => rowClicks++}>
          <FavoriteStar symbol="EQNR.OL" name="Equinor" exchange="OSL" />
        </div>
      </FavoritesProvider>
    );

    await user.click(screen.getByRole('button'));

    expect(rowClicks).toBe(0);
  });
});
