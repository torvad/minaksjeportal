import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";

interface ValuationStock {
  symbol: string;
  name: string;
  peRatio: number | null;
  pbRatio: number | null;
  dividendYield: number | null;
  changePercent: number;
}

const ACCENT = {
  '--box-c1': '#6366f1',
  '--box-c2': '#818cf8',
  '--box-hover-text': '#a5b4fc',
  '--box-val-color': '#a5b4fc',
} as React.CSSProperties;

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtVal(v: number | null, pct = false): string {
  if (v === null) return "—";
  return v.toFixed(2) + (pct ? "%" : "");
}

const EXCHANGE_LABEL: Record<string, string> = { OSL: "Oslo", STO: "Stockholm", CSE: "København", HEL: "Helsinki", ICE: "Reykjavik" };

export default function TopValuation({ exchange = "OSL" }: { exchange?: string }) {
  const [stocks, setStocks] = useState<ValuationStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { sorted, handleSort, ind } = useSortableData(stocks, "peRatio", true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/yahoo/all-valuation?exchange=${exchange}`);
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
    const id = setInterval(fetchAll, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchAll]);

  return (
    <div className="box" style={ACCENT}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">Verdsettelse</span>
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
              <th className="box-col-metric sortable" onClick={() => handleSort("peRatio")}>
                P/E<span className="sort-ind">{ind("peRatio")}</span>
              </th>
              <th className="box-col-metric sortable" onClick={() => handleSort("pbRatio")}>
                P/B<span className="sort-ind">{ind("pbRatio")}</span>
              </th>
              <th className="box-col-metric sortable" onClick={() => handleSort("dividendYield")}>
                Utbytte<span className="sort-ind">{ind("dividendYield")}</span>
              </th>
              <th className="box-col-pct sortable" onClick={() => handleSort("changePercent")}>
                Endring %<span className="sort-ind">{ind("changePercent")}</span>
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
              const pos = s.changePercent >= 0;
              return (
                <tr key={s.symbol} className="box-row">
                  <td className="box-col-stock">
                    <span className="box-name">{s.name}</span>
                    <span className="box-symbol">{s.symbol}</span>
                  </td>
                  <td className="box-col-metric" style={{ color: '#fcd34d' }}>{fmtVal(s.peRatio)}</td>
                  <td className="box-col-metric" style={{ color: '#7dd3fc' }}>{fmtVal(s.pbRatio)}</td>
                  <td className="box-col-metric" style={{ color: '#6ee7b7' }}>{fmtVal(s.dividendYield, true)}</td>
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
