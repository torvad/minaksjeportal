import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";

type ScreenerType = "quality" | "growth" | "dividend";

interface ScreenerStock {
  symbol: string;
  exchange: string;
  name: string;
  price: number;
  changePercent: number;
  peRatio: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  returnOnEquity: number | null;
  debtToEbitda: number | null;
  netIncome: number | null;
  dividendYield: number | null;
  payoutRatio: number | null;
  freeCashflow: number | null;
}

const EXCHANGE_COLOR: Record<string, string> = {
  OSL: "#6366f1", STO: "#0ea5e9", CSE: "#f59e0b", HEL: "#10b981", ICE: "#8b5cf6",
};

const EXCHANGE_FLAG: Record<string, string> = {
  OSL: "🇳🇴", STO: "🇸🇪", CSE: "🇩🇰", HEL: "🇫🇮", ICE: "🇮🇸",
};

const EXCHANGE_COUNTRY: Record<string, string> = {
  OSL: "Norge", STO: "Sverige", CSE: "Danmark", HEL: "Finland", ICE: "Island",
};

const ACCENT = {
  "--box-c1": "#6366f1",
  "--box-c2": "#818cf8",
  "--box-hover-text": "#a5b4fc",
  "--box-val-color": "#c4cdd9",
} as React.CSSProperties;

const CRITERIA: Record<ScreenerType, Array<{ label: string; value: string }>> = {
  quality: [
    { label: "Omsetn.vekst", value: "> 3%" },
    { label: "Nettoinntekt",  value: "> 0" },
    { label: "P/E",           value: "5 – 40" },
    { label: "Gjeld/EBITDA",  value: "< 5" },
    { label: "ROE",           value: "> 8%" },
  ],
  growth: [
    { label: "Omsetn.vekst",    value: "> 8%" },
    { label: "Resultatvekst",   value: "> 8%" },
    { label: "P/E",             value: "< 50" },
    { label: "ROE",             value: "> 10%" },
    { label: "Gjeld/EBITDA",    value: "< 4" },
  ],
  dividend: [
    { label: "Utbytteavkastn.", value: "> 3%" },
    { label: "Utbetalingsgrad", value: "< 80%" },
    { label: "P/E",             value: "5 – 35" },
    { label: "Fri kontantstr.", value: "> 0" },
    { label: "ROE",             value: "> 8%" },
    { label: "Gjeld/EBITDA",    value: "< 4" },
  ],
};

function fmtPct(v: number | null) { return v === null ? "—" : (v * 100).toFixed(1) + "%"; }
function fmtBig(v: number | null) {
  if (v === null) return "—";
  if (v >= 1e12) return (v / 1e12).toFixed(1) + "T";
  if (v >= 1e9)  return (v / 1e9).toFixed(1) + "B";
  if (v >= 1e6)  return (v / 1e6).toFixed(0) + "M";
  return v.toLocaleString();
}

export default function Screener() {
  const [screenerType, setScreenerType] = useState<ScreenerType>("quality");
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { sorted, handleSort, ind } = useSortableData(stocks, "revenueGrowth", false);

  const fetchAll = useCallback(async (type: ScreenerType) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/yahoo/screener?type=${type}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setStocks(data.stocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll("quality"); }, [fetchAll]);

  const selectType = (t: ScreenerType) => {
    if (screenerType === t) return;
    setScreenerType(t);
    setStocks([]);
    fetchAll(t);
  };

  const isGrowth = screenerType === "growth";
  const isDividend = screenerType === "dividend";

  return (
    <div className="box screener-box" style={ACCENT}>
      <div className="screener-filter-bar">
        <button
          className={`screener-filter-btn${screenerType === "quality" ? " active" : ""}`}
          onClick={() => selectType("quality")}
        >
          Kvalitet
        </button>
        <button
          className={`screener-filter-btn screener-filter-btn--growth${screenerType === "growth" ? " active" : ""}`}
          onClick={() => selectType("growth")}
        >
          Vekst
        </button>
        <button
          className={`screener-filter-btn screener-filter-btn--dividend${screenerType === "dividend" ? " active" : ""}`}
          onClick={() => selectType("dividend")}
        >
          Utbytte
        </button>
      </div>

      {screenerType && (
        <div className="screener-criteria">
          {CRITERIA[screenerType].map(c => (
            <div key={c.label} className="screener-criterion">
              <span className="screener-crit-label">{c.label}</span>
              <span className="screener-crit-value">{c.value}</span>
            </div>
          ))}
          {!loading && (
            <div className="screener-criterion screener-criterion--count">
              <span className="screener-crit-label">Treff</span>
              <span className="screener-crit-value">{sorted.length}</span>
            </div>
          )}
        </div>
      )}

      {loading && <div className="box-bar-wrap"><div className="box-bar-indeterminate" /></div>}
      {error && <div className="box-error">{error}</div>}

      <div className="box-table-wrap">
          <table className="box-table">
            <thead>
              <tr>
                <th className="box-col-stock sortable" onClick={() => handleSort("name")}>
                  Aksje<span className="sort-ind">{ind("name")}</span>
                </th>
                <th className="screener-col-exch">Marked</th>
                <th className="box-col-metric sortable" onClick={() => handleSort("peRatio")}>
                  P/E<span className="sort-ind">{ind("peRatio")}</span>
                </th>
                <th className="box-col-metric sortable" onClick={() => handleSort("revenueGrowth")}>
                  Omsetn.vekst<span className="sort-ind">{ind("revenueGrowth")}</span>
                </th>
                {isGrowth && (
                  <th className="box-col-metric sortable" onClick={() => handleSort("earningsGrowth")}>
                    Resultatvekst<span className="sort-ind">{ind("earningsGrowth")}</span>
                  </th>
                )}
                <th className="box-col-metric sortable" onClick={() => handleSort("returnOnEquity")}>
                  ROE<span className="sort-ind">{ind("returnOnEquity")}</span>
                </th>
                <th className="box-col-metric sortable" onClick={() => handleSort("debtToEbitda")}>
                  Gjeld/EBITDA<span className="sort-ind">{ind("debtToEbitda")}</span>
                </th>
                {isDividend && (
                  <th className="box-col-metric sortable" onClick={() => handleSort("dividendYield")}>
                    Utbytte<span className="sort-ind">{ind("dividendYield")}</span>
                  </th>
                )}
                {isDividend && (
                  <th className="box-col-metric sortable" onClick={() => handleSort("payoutRatio")}>
                    Utbetaling<span className="sort-ind">{ind("payoutRatio")}</span>
                  </th>
                )}
                {!isDividend && (
                  <th className="box-col-metric sortable" onClick={() => handleSort("netIncome")}>
                    Nettoinntekt<span className="sort-ind">{ind("netIncome")}</span>
                  </th>
                )}
                <th className="box-col-secondary sortable" onClick={() => handleSort("price")}>
                  Kurs<span className="sort-ind">{ind("price")}</span>
                </th>
                <th className="box-col-pct sortable" onClick={() => handleSort("changePercent")}>
                  Endring %<span className="sort-ind">{ind("changePercent")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && !loading && (
                <tr>
                  <td colSpan={9} className="box-empty">Ingen aksjer passerte kriteriene.</td>
                </tr>
              )}
              {sorted.map(s => {
                const pos = s.changePercent >= 0;
                const exchColor = EXCHANGE_COLOR[s.exchange] ?? "#64748b";
                return (
                  <tr key={s.symbol} className="box-row">
                    <td className="box-col-stock">
                      <span className="box-name" title={s.name}>{s.name}</span>
                      <span className="box-symbol">
                        <span className="box-flag" title={EXCHANGE_COUNTRY[s.exchange] ?? s.exchange}>{EXCHANGE_FLAG[s.exchange] ?? ""}</span>
                        {s.symbol}
                      </span>
                    </td>
                    <td className="screener-col-exch">
                      <span className="screener-exch-badge" style={{ background: exchColor + "33", color: exchColor, borderColor: exchColor + "66" }}>
                        {s.exchange}
                      </span>
                    </td>
                    <td className="box-col-metric" style={{ color: "#fcd34d" }}>{s.peRatio?.toFixed(1) ?? "—"}</td>
                    <td className="box-col-metric pos">{fmtPct(s.revenueGrowth)}</td>
                    {isGrowth && <td className="box-col-metric pos">{fmtPct(s.earningsGrowth)}</td>}
                    <td className="box-col-metric pos">{fmtPct(s.returnOnEquity)}</td>
                    <td className="box-col-metric">{s.debtToEbitda?.toFixed(2) ?? "—"}</td>
                    {isDividend && <td className="box-col-metric" style={{ color: "#4ade80" }}>{fmtPct(s.dividendYield)}</td>}
                    {isDividend && <td className="box-col-metric">{fmtPct(s.payoutRatio)}</td>}
                    {!isDividend && <td className="box-col-metric">{fmtBig(s.netIncome)}</td>}
                    <td className="box-col-secondary">{s.price.toFixed(2)}</td>
                    <td className={`box-col-pct ${pos ? "pos" : "neg"}`}>
                      {pos ? "+" : ""}{s.changePercent.toFixed(2)}%
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
