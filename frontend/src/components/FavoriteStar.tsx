import { useFavorites, FavoriteStock } from "../context/FavoritesContext";

export default function FavoriteStar({ symbol, name, exchange }: FavoriteStock) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const active = isFavorite(symbol);

  return (
    <button
      className={`favorite-star${active ? " active" : ""}`}
      title={active ? "Fjern fra favoritter" : "Legg til i favoritter"}
      onClick={(e) => {
        e.stopPropagation();
        toggleFavorite({ symbol, name, exchange });
      }}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
