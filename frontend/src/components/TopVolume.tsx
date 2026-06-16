import { useState, useEffect, useCallback } from "react";
import "./boxes.css";
import { useSortableData } from "../hooks/useSortableData";

interface TopStock {
  symbol: string;
  name: string;
  volume: number;
  turnover: number;
  price: number;
  change: number;
  changePercent: number;
}

const ACCENT = {
  '--box-c1': '#6366f1',
  '--box-c2': '#818cf8',
  '--box-hover-text': '#a5b4fc',
  '--box-val-color': '#c4cdd9',
} as React.CSSProperties;

const EXCHANGE_CURRENCY: Record<string, string> = { OSL: "NOK", STO: "SEK", CSE: "DKK", HEL: "EUR", ICE: "ISK" };
const EXCHANGE_LABEL: Record<string, string> = { OSL: "Oslo", STO: "Stockholm", CSE: "København", HEL: "Helsinki", ICE: "Reykjavik" };

function fmtTurnover(v: number, currency: string): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(".", ",") + ` M${currency}`;
  if (v >= 1_000_000) return Math.round(v / 1_000_000) + ` M${currency}`;
  if (v >= 1_000) return (v / 1_000).toFixed(0) + `k ${currency}`;
  return v.toLocaleString("nb-NO") + ` ${currency}`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function TopVolume({ exchange = "OSL" }: { exchange?: string }) {
  const [stocks, setStocks] = useState<TopStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { sorted, handleSort, ind } = useSortableData(stocks, "turnover", false);
  const maxTurnover = [...stocks].sort((a, b) => b.turnover - a.turnover)[0]?.turnover ?? 1;
  const currency = EXCHANGE_CURRENCY[exchange] ?? "NOK";

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/yahoo/all-volume?exchange=${exchange}`);
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
    fetch_();
    const id = setInterval(fetch_, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetch_]);

  return (
    <div className="box" style={ACCENT}>
      <div className="box-header">
        <div className="box-header-left">
          <span className="box-title">Høyest omsetning i dag</span>
          <span className="box-source">{EXCHANGE_LABEL[exchange] ?? exchange} · Yahoo Finance</span>
        </div>
        <div className="box-header-right">
          {lastUpdated && !loading && (
            <span className="box-updated">{fmtTime(lastUpdated)}</span>
          )}
          <button className="box-refresh-btn" onClick={fetch_} disabled={loading}>↻</button>
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
              <th className="box-col-value sortable" onClick={() => handleSort("turnover")}>
                Omsetning<span className="sort-ind">{ind("turnover")}</span>
              </th>
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
              <tr><td colSpan={5} className="box-empty">
                {error ? "Klarte ikke hente data." : "Ingen data."}
              </td></tr>
            )}
            {sorted.map(s => {
              const pos = s.change >= 0;
              const barPct = Math.round((s.turnover / maxTurnover) * 100);
              return (
                <tr key={s.symbol} className="box-row">
                  <td className="box-col-stock">
                    <span className="box-name">{s.name}</span>
                    <span className="box-symbol">{s.symbol}</span>
                  </td>
                  <td className="box-col-value">
                    <div className="box-val-cell">
                      <span className="box-val-num">{fmtTurnover(s.turnover, currency)}</span>
                      <div className="box-bar-track">
                        <div className="box-bar-fill" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  </td>
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
