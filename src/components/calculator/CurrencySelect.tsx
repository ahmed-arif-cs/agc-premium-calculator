"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENCY_META, PINNED_CODES, REGION_ORDER, metaFor } from "@/lib/currencyData";

interface CurrencySelectProps {
  codes: string[];
  value: string;
  onChange: (code: string) => void;
  label: string;
  disabled?: boolean;
}

export function CurrencySelect({ codes, value, onChange, label, disabled }: CurrencySelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    // Focus the search box once the panel mounts.
    const t = window.setTimeout(() => searchRef.current?.focus(), 10);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const codeSet = useMemo(() => new Set(codes), [codes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = codes.filter((c) => codeSet.has(c));
    if (!q) return pool;
    return pool.filter((c) => {
      const meta = metaFor(c);
      return c.toLowerCase().includes(q) || meta.name.toLowerCase().includes(q);
    });
  }, [codes, codeSet, query]);

  const pinned = useMemo(
    () => (query.trim() ? [] : PINNED_CODES.filter((c) => codeSet.has(c))),
    [codeSet, query],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const code of filtered) {
      if (!query.trim() && pinned.includes(code)) continue;
      const region = CURRENCY_META[code]?.region ?? "Europe";
      const list = map.get(region) ?? [];
      list.push(code);
      map.set(region, list);
    }
    for (const list of map.values()) list.sort();
    return map;
  }, [filtered, pinned, query]);

  const meta = metaFor(value);

  const select = (code: string) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  const toggleOpen = () => {
    if (open) setQuery("");
    setOpen(!open);
  };

  return (
    <div className="calc-csel" ref={rootRef}>
      <button
        type="button"
        className="calc-csel-trigger"
        onClick={() => !disabled && toggleOpen()}
        disabled={disabled}
        aria-label={label}
        aria-expanded={open}
      >
        <span className="calc-csel-flag">{meta.flag}</span>
        <span className="calc-csel-code">{value}</span>
        <ChevronDown className={cn("calc-csel-chev", open && "calc-csel-chev--open")} />
      </button>

      {open && (
        <div className="calc-csel-panel" role="listbox" aria-label={label}>
          <div className="calc-csel-search">
            <Search className="h-3.5 w-3.5" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search currency or code…"
              aria-label="Search currency"
            />
          </div>

          <div className="calc-csel-list">
            {pinned.length > 0 && (
              <div className="calc-csel-group">
                <div className="calc-csel-group-label">Popular</div>
                {pinned.map((code) => (
                  <CurrencyRow key={code} code={code} active={code === value} onSelect={select} />
                ))}
              </div>
            )}

            {REGION_ORDER.map((region) => {
              const list = grouped.get(region);
              if (!list || list.length === 0) return null;
              return (
                <div className="calc-csel-group" key={region}>
                  <div className="calc-csel-group-label">{region}</div>
                  {list.map((code) => (
                    <CurrencyRow key={code} code={code} active={code === value} onSelect={select} />
                  ))}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="calc-csel-empty">No currency matches “{query}”.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CurrencyRow({
  code,
  active,
  onSelect,
}: {
  code: string;
  active: boolean;
  onSelect: (code: string) => void;
}) {
  const meta = metaFor(code);
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      className={cn("calc-csel-row", active && "calc-csel-row--active")}
      onClick={() => onSelect(code)}
    >
      <span className="calc-csel-flag">{meta.flag}</span>
      <span className="calc-csel-row-code">{code}</span>
      <span className="calc-csel-row-name">{meta.name}</span>
    </button>
  );
}
