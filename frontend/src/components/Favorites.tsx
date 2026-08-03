import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";
import { useFavorites } from "../context/FavoritesContext";
import FavoriteStar from "./FavoriteStar";

interface FavoriteQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
}

const ACCENT = {
  "--box-c1": "#f59e0b",
  "--box-c2": "#fbbf24",
  "--box-hover-text": "#fcd34d",
  "--box-val-color": "#c4cdd9",
} as React.CSSProperties;

function fmt2(v: number): string {
  return isNaN(v) ? "—" : v.toFixed(2);
}

function fmtVol(v: number): string {
  if (!v || isNaN(v)) return "—";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "k";
  return v.toString();
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function Favorites() {
  const { favorites } = useFavorites();
  const [quotes, setQuotes] = useState<FavoriteQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { sorted, handleSort, ind } = useSortableData(quotes, "", false);

  const fetchQuotes = useCallback(async () => {
    if (favorites.length === 0) {
      setQuotes([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const symbols = favorites.map(f => f.symbol).join(",");
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/yahoo/quotes-by-symbols?symbols=${encodeURIComponent(symbols)}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setQuotes(data.quotes ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [favorites]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const nameFor = (symbol: string) => favorites.find(f => f.symbol === symbol)?.name ?? symbol;
  const exchangeFor = (symbol: string) => favorites.find(f => f.symbol === symbol)?.exchange ?? "";

  return (
    <div className="box screener-box" style={ACCENT}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">Favoritter</span>
          <span className="box-source">Din personlige liste · finance.yahoo.com</span>
        </div>
        <div className="box-header-right">
          {lastUpdated && !loading && (
            <span className="box-updated">{fmtTime(lastUpdated)}</span>
          )}
          <button className="box-refresh-btn" onClick={fetchQuotes} disabled={loading}>↻</button>
        </div>
      </div>

      {loading && <div className="box-bar-wrap"><div className="box-bar-indeterminate" /></div>}
      {error && <div className="box-error">{error}</div>}

      <div className="box-table-wrap">
        <table className="box-table">
          <thead>
            <tr>
              <th className="box-col-fav" />
              <th className="box-col-stock sortable" onClick={() => handleSort("name")}>
                Aksje<span className="sort-ind">{ind("name")}</span>
              </th>
              <th className="box-col-secondary sortable" onClick={() => handleSort("price")}>
                Kurs<span className="sort-ind">{ind("price")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("changePercent")}>
                Endring %<span className="sort-ind">{ind("changePercent")}</span>
              </th>
              <th className="box-col-secondary sortable" onClick={() => handleSort("volume")}>
                Volum<span className="sort-ind">{ind("volume")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {favorites.length === 0 && (
              <tr>
                <td colSpan={5} className="box-empty">
                  Ingen favoritter ennå. Klikk på stjernen ved en aksje for å følge den.
                </td>
              </tr>
            )}
            {favorites.length > 0 && sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="box-empty">
                  {error ? "Klarte ikke hente data." : "Ingen data."}
                </td>
              </tr>
            )}
            {sorted.map(q => {
              const pos = q.change >= 0;
              return (
                <tr key={q.symbol} className="box-row">
                  <td className="box-col-fav">
                    <FavoriteStar symbol={q.symbol} name={nameFor(q.symbol)} exchange={exchangeFor(q.symbol)} />
                  </td>
                  <td className="box-col-stock">
                    <span className="box-name">{nameFor(q.symbol)}</span>
                    <span className="box-symbol">{q.symbol}</span>
                  </td>
                  <td className="box-col-secondary">{fmt2(q.price)}</td>
                  <td className={`box-col-pct ${pos ? "pos" : "neg"}`}>
                    {pos ? "+" : ""}{isNaN(q.changePercent) ? "—" : q.changePercent.toFixed(2)}%
                  </td>
                  <td className="box-col-secondary">{fmtVol(q.volume)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
