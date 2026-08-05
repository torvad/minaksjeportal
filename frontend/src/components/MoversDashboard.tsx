import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";
import FavoriteStar from "./FavoriteStar";

interface MoverQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
  exchange: string;
  oneYear: number | null;
  threeYear: number | null;
  fiveYear: number | null;
}

const EXCHANGES = [
  { code: "OSL", label: "Oslo" },
  { code: "STO", label: "Stockholm" },
  { code: "CSE", label: "København" },
  { code: "HEL", label: "Helsinki" },
  { code: "ICE", label: "Reykjavik" },
];

const EXCHANGE_COLOR: Record<string, string> = {
  OSL: "#6366f1", STO: "#0ea5e9", CSE: "#f59e0b", HEL: "#10b981", ICE: "#8b5cf6",
};

const EXCHANGE_FLAG: Record<string, string> = {
  OSL: "🇳🇴", STO: "🇸🇪", CSE: "🇩🇰", HEL: "🇫🇮", ICE: "🇮🇸",
};

const GAIN_ACCENT = {
  "--box-c1": "#10b981",
  "--box-c2": "#34d399",
  "--box-hover-text": "#6ee7b7",
  "--box-val-color": "#c4cdd9",
} as React.CSSProperties;

const LOSS_ACCENT = {
  "--box-c1": "#ef4444",
  "--box-c2": "#f87171",
  "--box-hover-text": "#fca5a5",
  "--box-val-color": "#c4cdd9",
} as React.CSSProperties;

const TOP_N = 20;

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtGrowth(v: number | null | undefined): string {
  if (v === null || v === undefined || isNaN(v)) return "—";
  return (v >= 0 ? "+" : "") + Math.round(v) + "%";
}

interface MoverPanelProps {
  title: string;
  accent: React.CSSProperties;
  quotes: MoverQuote[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
  defaultAsc: boolean;
}

function MoverPanel({ title, accent, quotes, loading, error, lastUpdated, onRefresh, defaultAsc }: MoverPanelProps) {
  const { sorted, handleSort, ind } = useSortableData(quotes, "changePercent", defaultAsc);

  return (
    <div className="box" style={accent}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">{title}</span>
          <span className="box-source">Alle nordiske markeder · finance.yahoo.com</span>
        </div>
        <div className="box-header-right">
          {lastUpdated && !loading && (
            <span className="box-updated">{fmtTime(lastUpdated)}</span>
          )}
          <button className="box-refresh-btn" onClick={onRefresh} disabled={loading}>↻</button>
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
              <th className="screener-col-exch">Marked</th>
              <th className="box-col-secondary sortable" onClick={() => handleSort("price")}>
                Kurs<span className="sort-ind">{ind("price")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("changePercent")}>
                Endring %<span className="sort-ind">{ind("changePercent")}</span>
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
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="box-empty">
                  {error ? "Klarte ikke hente data." : "Ingen data."}
                </td>
              </tr>
            )}
            {sorted.map(q => {
              const pos = q.change >= 0;
              const exchColor = EXCHANGE_COLOR[q.exchange] ?? "#64748b";
              return (
                <tr key={`${q.exchange}-${q.symbol}`} className="box-row">
                  <td className="box-col-fav">
                    <FavoriteStar symbol={q.symbol} name={q.name} exchange={q.exchange} />
                  </td>
                  <td className="box-col-stock">
                    <span className="box-name" title={q.name}>{q.name}</span>
                    <span className="box-symbol">
                      <span className="box-flag">{EXCHANGE_FLAG[q.exchange] ?? ""}</span>
                      {q.symbol}
                    </span>
                  </td>
                  <td className="screener-col-exch">
                    <span
                      className="screener-exch-badge"
                      style={{ background: exchColor + "33", color: exchColor, borderColor: exchColor + "66" }}
                    >
                      {q.exchange}
                    </span>
                  </td>
                  <td className="box-col-secondary">{isNaN(q.price) ? "—" : q.price.toFixed(2)}</td>
                  <td className={`box-col-pct ${pos ? "pos" : "neg"}`}>
                    {pos ? "+" : ""}{isNaN(q.changePercent) ? "—" : q.changePercent.toFixed(2)}%
                  </td>
                  <td className={`box-col-pct ${q.oneYear !== null && q.oneYear >= 0 ? "pos" : q.oneYear !== null ? "neg" : ""}`}>
                    {fmtGrowth(q.oneYear)}
                  </td>
                  <td className={`box-col-pct ${q.threeYear !== null && q.threeYear >= 0 ? "pos" : q.threeYear !== null ? "neg" : ""}`}>
                    {fmtGrowth(q.threeYear)}
                  </td>
                  <td className={`box-col-pct ${q.fiveYear !== null && q.fiveYear >= 0 ? "pos" : q.fiveYear !== null ? "neg" : ""}`}>
                    {fmtGrowth(q.fiveYear)}
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

export default function MoversDashboard() {
  const [quotes, setQuotes] = useState<MoverQuote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const base = import.meta.env.VITE_API_URL ?? "";
      const results = await Promise.allSettled(
        EXCHANGES.map(async (ex) => {
          const res = await fetch(`${base}/api/yahoo/all-quotes?exchange=${ex.code}`);
          if (!res.ok) throw new Error(`${ex.label}: API error ${res.status}`);
          const data = await res.json();
          return ((data.quotes ?? []) as Omit<MoverQuote, "exchange" | "oneYear" | "threeYear" | "fiveYear">[])
            .map(q => ({ ...q, exchange: ex.code, oneYear: null, threeYear: null, fiveYear: null }));
        })
      );

      // One flaky exchange (Iceland is often slow/thin) shouldn't blank out the
      // whole cross-market view — keep whatever succeeded and just flag the rest.
      const merged: MoverQuote[] = [];
      const failed: string[] = [];
      results.forEach((result, i) => {
        if (result.status === "fulfilled") merged.push(...result.value);
        else failed.push(EXCHANGES[i].label);
      });

      const valid = merged.filter(q => !isNaN(q.changePercent));

      // Only fetch 1y/3y/5y growth for the symbols that actually make the top/bottom
      // lists — not the whole cross-market universe — since each symbol costs its own
      // Yahoo chart request on the backend.
      const gainerSymbols = [...valid].sort((a, b) => b.changePercent - a.changePercent).slice(0, TOP_N).map(q => q.symbol);
      const loserSymbols = [...valid].sort((a, b) => a.changePercent - b.changePercent).slice(0, TOP_N).map(q => q.symbol);
      const neededSymbols = Array.from(new Set([...gainerSymbols, ...loserSymbols]));

      if (neededSymbols.length > 0) {
        try {
          const returnsRes = await fetch(`${base}/api/yahoo/historical-returns?symbols=${encodeURIComponent(neededSymbols.join(","))}`);
          if (returnsRes.ok) {
            const returnsData = await returnsRes.json();
            const returnsBySymbol = new Map((returnsData.returns ?? []).map((r: any) => [r.symbol, r]));
            for (const q of valid) {
              const ret = returnsBySymbol.get(q.symbol) as any;
              if (ret) {
                q.oneYear = ret.oneYear ?? null;
                q.threeYear = ret.threeYear ?? null;
                q.fiveYear = ret.fiveYear ?? null;
              }
            }
          }
        } catch {
          // Growth columns are a bonus on top of the price/volume data — if this
          // call fails, still show the movers list with those columns left blank.
        }
      }

      setQuotes(valid);
      setError(failed.length > 0 ? `Klarte ikke hente data for: ${failed.join(", ")}` : "");
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  const gainers = [...quotes].sort((a, b) => b.changePercent - a.changePercent).slice(0, TOP_N);
  const losers = [...quotes].sort((a, b) => a.changePercent - b.changePercent).slice(0, TOP_N);

  return (
    <>
      <MoverPanel
        title="Størst oppgang"
        accent={GAIN_ACCENT}
        quotes={gainers}
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={fetchAll}
        defaultAsc={false}
      />
      <MoverPanel
        title="Størst nedgang"
        accent={LOSS_ACCENT}
        quotes={losers}
        loading={loading}
        error={error}
        lastUpdated={lastUpdated}
        onRefresh={fetchAll}
        defaultAsc={true}
      />
    </>
  );
}
