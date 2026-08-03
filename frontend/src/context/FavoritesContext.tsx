import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export interface FavoriteStock {
  symbol: string;
  name: string;
  exchange: string;
}

interface FavoritesContextValue {
  favorites: FavoriteStock[];
  isFavorite: (symbol: string) => boolean;
  toggleFavorite: (stock: FavoriteStock) => void;
  removeFavorite: (symbol: string) => void;
}

const STORAGE_KEY = "minaksjeportal:favorites";

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function loadFavorites(): FavoriteStock[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteStock[]>(() => loadFavorites());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch {
      // localStorage unavailable (e.g. private browsing) — favorites stay in-memory only
    }
  }, [favorites]);

  const value = useMemo<FavoritesContextValue>(() => ({
    favorites,
    isFavorite: (symbol: string) => favorites.some(f => f.symbol === symbol),
    toggleFavorite: (stock: FavoriteStock) => {
      setFavorites(prev =>
        prev.some(f => f.symbol === stock.symbol)
          ? prev.filter(f => f.symbol !== stock.symbol)
          : [...prev, stock]
      );
    },
    removeFavorite: (symbol: string) => {
      setFavorites(prev => prev.filter(f => f.symbol !== symbol));
    },
  }), [favorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within a FavoritesProvider");
  return ctx;
}
