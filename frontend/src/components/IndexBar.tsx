import { useState, useEffect, useCallback } from "react";
import "./CurrencyBar.css";

interface IndexQuote {
  code: string;
  name: string;
  price: number | null;
  change: number;
  changePercent: number;
}

function fmtPct(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export default function IndexBar() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [error, setError] = useState(false);

  const fetchIndices = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/yahoo/indices`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setIndices(data.indices ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchIndices();
    const id = setInterval(fetchIndices, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchIndices]);

  if (error && indices.length === 0) return null;

  return (
    <div className="currency-bar" aria-label="Nordiske børsindekser">
      {indices.filter(i => i.price !== null).map(i => {
        const pos = i.changePercent >= 0;
        return (
          <span className="currency-item" key={i.code} title={`${i.name}: ${i.price!.toLocaleString("nb-NO", { maximumFractionDigits: 2 })}`}>
            <span className="currency-code">{i.code}</span>
            <span className={`currency-price ${pos ? "pos" : "neg"}`}>{fmtPct(i.changePercent)}</span>
          </span>
        );
      })}
    </div>
  );
}
