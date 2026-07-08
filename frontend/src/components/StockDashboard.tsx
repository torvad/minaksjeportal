import { useState, useEffect, useCallback } from "react";
import "./StockDashboard.css";
import "./boxes.css";
import TopVolume from "./TopVolume";
import TopValuation from "./TopValuation";
import TopFinancials from "./TopFinancials";
import Screener from "./Screener";
import { useSortableData } from "../hooks/useSortableData";

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  previousClose: number;
}

const ACCENT = {
  '--box-c1': '#6366f1',
  '--box-c2': '#818cf8',
  '--box-hover-text': '#a5b4fc',
  '--box-val-color': '#c4cdd9',
} as React.CSSProperties;

const EXCHANGES = [
  { code: "OSL", label: "Oslo" },
  { code: "STO", label: "Stockholm" },
  { code: "CSE", label: "København" },
  { code: "HEL", label: "Helsinki" },
  { code: "ICE", label: "Reykjavik" },
];

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

interface PanelProps {
  title: string;
  source: string;
  quotes: StockQuote[];
  loading: boolean;
  error: string;
  lastUpdated: Date | null;
  onRefresh: () => void;
}

function SourcePanel({ title, source, quotes, loading, error, lastUpdated, onRefresh }: PanelProps) {
  const { sorted, handleSort, ind } = useSortableData(quotes, "", false);

  return (
    <div className="box" style={ACCENT}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">{title}</span>
          <span className="box-source">{source}</span>
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
            {sorted.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="box-empty">
                  {error ? "Klarte ikke hente data." : "Ingen data."}
                </td>
              </tr>
            )}
            {sorted.map(q => {
              const pos = q.change >= 0;
              return (
                <tr key={q.symbol} className="box-row">
                  <td className="box-col-stock">
                    <span className="box-name">{q.name}</span>
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

export default function StockDashboard() {
  const [view, setView] = useState<"screener" | "exchange">("exchange");
  const [exchange, setExchange] = useState("OSL");
  const [yfQuotes, setYfQuotes] = useState<StockQuote[]>([]);
  const [yfLoading, setYfLoading] = useState(false);
  const [yfError, setYfError] = useState("");
  const [yfLastUpdated, setYfLastUpdated] = useState<Date | null>(null);

  const fetchYahoo = useCallback(async () => {
    setYfLoading(true);
    setYfError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/yahoo/all-quotes?exchange=${exchange}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setYfQuotes(data.quotes ?? []);
      setYfLastUpdated(new Date());
    } catch (err) {
      setYfError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setYfLoading(false);
    }
  }, [exchange]);

  useEffect(() => {
    fetchYahoo();
  }, [fetchYahoo]);

  const activeLabel = view === "screener"
    ? "Screener"
    : (EXCHANGES.find(e => e.code === exchange)?.label ?? exchange);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="dashboard-title">{activeLabel}</h1>
          <span className="header-subtitle">Live markedsdata</span>
        </div>
        <nav className="exchange-tabs">
          <button
            className={`exchange-tab screener-tab${view === "screener" ? " active" : ""}`}
            onClick={() => setView("screener")}
          >
            Screener
          </button>
          <div className="tab-divider" />
          {EXCHANGES.map(ex => (
            <button
              key={ex.code}
              className={`exchange-tab${view === "exchange" && exchange === ex.code ? " active" : ""}`}
              onClick={() => { setView("exchange"); setExchange(ex.code); }}
            >
              {ex.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="dashboard-body">
        {view === "screener" ? (
          <div className="panels-grid">
            <Screener />
          </div>
        ) : (
          <div className="panels-grid panels-grid--exchange">
            <SourcePanel
              title="Yahoo Finance" source={`${activeLabel} · finance.yahoo.com`}
              quotes={yfQuotes} loading={yfLoading}
              error={yfError} lastUpdated={yfLastUpdated}
              onRefresh={fetchYahoo}
            />
            <TopVolume exchange={exchange} />
            <TopValuation exchange={exchange} />
            <TopFinancials exchange={exchange} />
          </div>
        )}
      </div>
    </div>
  );
}
