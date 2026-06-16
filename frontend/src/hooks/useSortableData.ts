import { useState, useMemo } from "react";

export function useSortableData<T extends Record<string, any>>(
  items: T[],
  defaultKey = "",
  defaultAsc = false
) {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortAsc, setSortAsc] = useState(defaultAsc);

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    return [...items].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const aNull = av === null || av === undefined;
      const bNull = bv === null || bv === undefined;
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      const mul = sortAsc ? 1 : -1;
      if (typeof av === "string") return mul * av.localeCompare(bv);
      return mul * (av - bv);
    });
  }, [items, sortKey, sortAsc]);

  function handleSort(key: string) {
    if (key === sortKey) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  }

  function ind(key: string): string {
    if (key !== sortKey) return "";
    return sortAsc ? " ▲" : " ▼";
  }

  return { sorted, handleSort, ind };
}
