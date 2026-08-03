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
  previousClose: number;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
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

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtReturn(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + Math.round(v) + "%";
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
      const base = import.meta.env.VITE_API_URL ?? "";
      const symbols = favorites.map(f => f.symbol).join(",");
      const [quotesRes, returnsRes] = await Promise.all([
        fetch(`${base}/api/yahoo/quotes-by-symbols?symbols=${encodeURIComponent(symbols)}`),
        fetch(`${base}/api/yahoo/historical-returns?symbols=${encodeURIComponent(symbols)}`),
      ]);
      if (!quotesRes.ok) throw new Error(`API error ${quotesRes.status}`);
      const quotesData = await quotesRes.json();
      const returnsData = returnsRes.ok ? await returnsRes.json() : { returns: [] };
      const returnsBySymbol = new Map(
        (returnsData.returns ?? []).map((r: any) => [r.symbol, r])
      );
      const merged: FavoriteQuote[] = (quotesData.quotes ?? []).map((q: any) => {
        const ret = returnsBySymbol.get(q.symbol) as any;
        return {
          ...q,
          oneYear: ret?.oneYear ?? null,
          threeYear: ret?.threeYear ?? null,
          fiveYear: ret?.fiveYear ?? null,
        };
      });
      setQuotes(merged);
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
        <table className="box-table favorites-table">
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
                <span className="th-label-full">Endring %</span>
                <span className="th-label-short">Endr</span>
                <span className="sort-ind">{ind("changePercent")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("oneYear")}>
                1 år<span className="sort-ind">{ind("oneYear")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("threeYear")}>
                3 år<span className="sort-ind">{ind("threeYear")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("fiveYear")}>
                5 år<span className="sort-ind">{ind("fiveYear")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {favorites.length === 0 && (
              <tr>
                <td colSpan={7} className="box-empty">
                  Ingen favoritter ennå. Klikk på stjernen ved en aksje for å følge den.
                </td>
              </tr>
            )}
            {favorites.length > 0 && sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="box-empty">
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
                  <td className={`box-col-pct ${q.oneYear !== null && q.oneYear >= 0 ? "pos" : q.oneYear !== null ? "neg" : ""}`}>
                    {fmtReturn(q.oneYear)}
                  </td>
                  <td className={`box-col-pct ${q.threeYear !== null && q.threeYear >= 0 ? "pos" : q.threeYear !== null ? "neg" : ""}`}>
                    {fmtReturn(q.threeYear)}
                  </td>
                  <td className={`box-col-pct ${q.fiveYear !== null && q.fiveYear >= 0 ? "pos" : q.fiveYear !== null ? "neg" : ""}`}>
                    {fmtReturn(q.fiveYear)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
