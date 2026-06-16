import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";

interface FinancialStock {
  symbol: string;
  name: string;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  debtToEquity: number | null;
  totalDebt: number | null;
}

const ACCENT = {
  '--box-c1': '#10b981',
  '--box-c2': '#34d399',
  '--box-hover-text': '#6ee7b7',
  '--box-val-color': '#6ee7b7',
} as React.CSSProperties;

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return (v * 100).toFixed(1) + "%";
}

function fmtDE(v: number | null): string {
  if (v === null) return "—";
  return v.toFixed(1);
}

function fmtDebt(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1_000_000_000_000) return (v / 1_000_000_000_000).toFixed(1) + " TNOK";
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + " BNOK";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(0) + " MNOK";
  return v.toLocaleString("nb-NO") + " NOK";
}

const EXCHANGE_LABEL: Record<string, string> = { OSL: "Oslo", STO: "Stockholm", CSE: "København", HEL: "Helsinki", ICE: "Reykjavik" };

export default function TopFinancials({ exchange = "OSL" }: { exchange?: string }) {
  const [stocks, setStocks] = useState<FinancialStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { sorted, handleSort, ind } = useSortableData(stocks, "revenueGrowth", false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/yahoo/all-financials?exchange=${exchange}`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setStocks(data.stocks ?? []);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch");
    } finally {
      setLoading(false);
    }
  }, [exchange]);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <div className="box" style={ACCENT}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">Finansielle nøkkeltall</span>
          <span className="box-source">{EXCHANGE_LABEL[exchange] ?? exchange} · Yahoo Finance</span>
        </div>
        <div className="box-header-right">
          {lastUpdated && !loading && (
            <span className="box-updated">{fmtTime(lastUpdated)}</span>
          )}
          <button className="box-refresh-btn" onClick={fetchAll} disabled={loading}>↻</button>
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
              <th className="box-col-metric sortable" onClick={() => handleSort("revenueGrowth")}>
                Omsetn. vekst<span className="sort-ind">{ind("revenueGrowth")}</span>
              </th>
              <th className="box-col-metric sortable" onClick={() => handleSort("earningsGrowth")}>
                Resultat vekst<span className="sort-ind">{ind("earningsGrowth")}</span>
              </th>
              <th className="box-col-metric sortable" onClick={() => handleSort("debtToEquity")}>
                Gjeld/EK<span className="sort-ind">{ind("debtToEquity")}</span>
              </th>
              <th className="box-col-metric sortable" onClick={() => handleSort("totalDebt")}>
                Total gjeld<span className="sort-ind">{ind("totalDebt")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading && (
              <tr><td colSpan={5} className="box-empty">
                {error ? "Klarte ikke hente data." : "Ingen data."}
              </td></tr>
            )}
            {sorted.map(s => {
              const revPos = s.revenueGrowth !== null && s.revenueGrowth >= 0;
              const earnPos = s.earningsGrowth !== null && s.earningsGrowth >= 0;
              return (
                <tr key={s.symbol} className="box-row">
                  <td className="box-col-stock">
                    <span className="box-name">{s.name}</span>
                    <span className="box-symbol">{s.symbol}</span>
                  </td>
                  <td className={`box-col-metric ${s.revenueGrowth !== null ? (revPos ? "pos" : "neg") : ""}`}>
                    {fmtPct(s.revenueGrowth)}
                  </td>
                  <td className={`box-col-metric ${s.earningsGrowth !== null ? (earnPos ? "pos" : "neg") : ""}`}>
                    {fmtPct(s.earningsGrowth)}
                  </td>
                  <td className="box-col-metric">{fmtDE(s.debtToEquity)}</td>
                  <td className="box-col-metric">{fmtDebt(s.totalDebt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
