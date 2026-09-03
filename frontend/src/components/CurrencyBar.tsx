import { useState, useEffect, useCallback } from "react";
import "./CurrencyBar.css";

interface FxRate {
  base: string;
  quote: string;
  name: string;
  price: number | null;
  change: number;
  changePercent: number;
}

// SEK/DKK trade near parity with NOK, so — like Norges Bank — they're quoted
// per 100 units (100 SEK ≈ 97 NOK) rather than per 1.
const PER_100 = new Set(["SEK", "DKK"]);

function fmtRate(base: string, v: number | null): string {
  if (v === null || isNaN(v)) return "—";
  const scaled = PER_100.has(base) ? v * 100 : v;
  return scaled.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(v: number): string {
  if (isNaN(v)) return "";
  return (v >= 0 ? "+" : "") + v.toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
}

export default function CurrencyBar() {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [error, setError] = useState(false);

  const fetchRates = useCallback(async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/yahoo/fx`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      setRates(data.rates ?? []);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchRates]);

  if (error && rates.length === 0) return null;

  return (
    <div className="currency-bar" aria-label="Valutakurser mot NOK">
      {rates.map(r => {
        const pos = r.changePercent >= 0;
        return (
          <span className="currency-item" key={r.base} title={`${r.name} → NOK`}>
            <span className="currency-code">{r.base}</span>
            <span className="currency-price">{fmtRate(r.base, r.price)}</span>
            <span className={`currency-pct ${pos ? "pos" : "neg"}`}>{fmtPct(r.changePercent)}</span>
          </span>
        );
      })}
    </div>
  );
}
