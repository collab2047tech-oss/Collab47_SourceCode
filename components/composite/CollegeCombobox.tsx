"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INDIAN_COLLEGES } from "@/lib/data/colleges";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Search } from "lucide-react";

/**
 * Where the combobox draws its suggestions from.
 *  - "institution": the /api/directory institution index, MERGED on top of the
 *    curated local INDIAN_COLLEGES list so it feels instant even before the API
 *    warms up. Used by student / researcher / faculty / institution accounts.
 *  - "startup": the /api/directory startup index only (no local list - there is
 *    no curated startup list to fall back to). Used by startup accounts.
 *  - "none": no dropdown at all. A plain text field. Used by industry accounts,
 *    whose companies are not DPIIT startups and have no directory to search yet.
 */
export type ComboboxSource = { kind: "institution" | "startup" | "none" };

/** Contract of GET /api/directory/search (built in parallel by W4-C). */
interface DirectoryItem {
  name: string;
  city?: string;
  state?: string;
}

interface Option extends DirectoryItem {
  value: string;
  label: string;
  add: boolean;
}

interface CollegeComboboxProps {
  /** Current committed value (either a listed suggestion or free text). */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Retained for call compatibility; free text is typed directly into the main
   *  field, so there is no separate "Other" input to placeholder. */
  otherPlaceholder?: string;
  autoFocus?: boolean;
  /** Which directory to search. Defaults to the institution index. */
  source?: ComboboxSource;
}

// How many merged options to show. Institution browsing (empty query) shows a
// deeper slice of the local list; an active search stays tidy at the API cap.
const MAX_BROWSE = 50;
const MAX_SEARCH = 12;

/**
 * Accessible combobox with a type-to-filter dropdown, keyboard navigation, and
 * first-class free text. The typed text IS the committed value (`value` updates
 * on every keystroke), so what the field shows is always what the form stores -
 * suggestions merely refine it on selection. This survives an empty / failing
 * directory API untouched: if nothing comes back, the person just types their
 * own and Continue is satisfied by the free text.
 *
 * Founder-reported bug this fixes: the combobox used to search ONE hardcoded
 * college list regardless of account type, so a Startup was offered COLLEGES.
 * The `source` prop now routes institution vs startup vs plain-text per type.
 */
export function CollegeCombobox({
  value,
  onChange,
  label = "Institution",
  placeholder = "Search your institution",
  autoFocus,
  source = { kind: "institution" },
}: CollegeComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [apiItems, setApiItems] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const trimmed = value.trim();
  const q = trimmed.toLowerCase();

  // Instant local layer, institution only. Startups have no curated list.
  const localMatches = useMemo<DirectoryItem[]>(() => {
    if (source.kind !== "institution") return [];
    const base = q
      ? INDIAN_COLLEGES.filter((c) => c.toLowerCase().includes(q))
      : INDIAN_COLLEGES;
    return base.slice(0, MAX_BROWSE).map((name) => ({ name }));
  }, [q, source.kind]);

  // Async directory layer. Debounced, with an AbortController so a stale query's
  // response can never overwrite a newer one. Network failure / empty / non-2xx
  // all collapse to "no API suggestions" and we lean on the local list + free
  // text - the directory route 404s until W4-C lands, and that is handled here.
  useEffect(() => {
    if (source.kind === "none") {
      setApiItems([]);
      return;
    }
    const query = trimmed;
    if (!query) {
      setApiItems([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/directory/search?kind=${source.kind}&q=${encodeURIComponent(query)}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) {
          setApiItems([]);
          return;
        }
        const json = (await res.json()) as { items?: DirectoryItem[] };
        setApiItems(Array.isArray(json.items) ? json.items.slice(0, MAX_SEARCH) : []);
      } catch {
        // Aborted (stale) or offline / route missing -> no suggestions, free text.
        if (!ctrl.signal.aborted) setApiItems([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      window.clearTimeout(t);
      ctrl.abort();
    };
  }, [trimmed, source.kind]);

  // Merge: local matches first, then API results, deduped by name (case-insensitive).
  const merged = useMemo<DirectoryItem[]>(() => {
    const out: DirectoryItem[] = [];
    const seen = new Set<string>();
    for (const it of [...localMatches, ...apiItems]) {
      const key = it.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(it);
    }
    const cap = source.kind === "institution" && !trimmed ? MAX_BROWSE : MAX_SEARCH;
    return out.slice(0, cap);
  }, [localMatches, apiItems, source.kind, trimmed]);

  // Is what they typed already an exact suggestion? If so we drop the "use your
  // own" row (the value is a real listed entry).
  const exactInList = useMemo(
    () => merged.some((it) => it.name.toLowerCase() === q),
    [merged, q]
  );
  const showAddOwn = trimmed.length > 0 && !exactInList;

  const options = useMemo<Option[]>(
    () => [
      ...merged.map((it) => ({
        ...it,
        value: it.name,
        label: it.name,
        add: false,
      })),
      ...(showAddOwn
        ? [{ name: trimmed, value: trimmed, label: `Use "${trimmed}"`, add: true }]
        : []),
    ],
    [merged, showAddOwn, trimmed]
  );

  // Close on outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Keep the active option scrolled into view.
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function commit(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(options.length - 1, a + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(0, a - 1));
    } else if (e.key === "Enter") {
      // Enter selects the highlighted option only when the list is open. When it
      // is closed the typed value already stands, so we do nothing and let the
      // parent step's Enter-to-advance take over.
      if (open && options[active]) {
        e.preventDefault();
        commit(options[active].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // ---- Plain text field (kind "none"): no dropdown, no directory. ----
  // All hooks above already ran, so this early return is safe.
  if (source.kind === "none") {
    return (
      <div className="flex w-full flex-col gap-2">
        <label htmlFor={`${listId}-input`} className="text-caption text-ink">
          {label}
        </label>
        <input
          id={`${listId}-input`}
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="h-14 w-full rounded-lg border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/20"
        />
      </div>
    );
  }

  const selected = trimmed.length > 0 && exactInList;

  return (
    <div className="flex w-full flex-col gap-2" ref={rootRef}>
      <label htmlFor={`${listId}-input`} className="text-caption text-ink">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            // The typed text IS the value now - no hidden `query` that leaves the
            // form empty while the field looks filled.
            onChange(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
          className={cn(
            "h-14 w-full rounded-lg border bg-paper pl-11 pr-11 text-base text-ink placeholder:text-ash transition-colors focus:outline-none focus:ring-2 focus:ring-saffron/20",
            selected && !open ? "border-saffron" : "border-ink/15 focus:border-saffron"
          )}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            setOpen((o) => !o);
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-ash transition-colors hover:text-ink"
          aria-label="Toggle list"
        >
          <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {open ? (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-30 mt-[88px] max-h-72 w-[calc(100%-0px)] overflow-auto rounded-xl border border-bone bg-paper p-1.5 shadow-xl shadow-ink/10"
          style={{ maxWidth: rootRef.current?.offsetWidth }}
        >
          {options.map((opt, i) => {
            const isActive = i === active;
            const isSelected = !opt.add && opt.value.toLowerCase() === q;
            const sub = !opt.add
              ? [opt.city, opt.state].filter(Boolean).join(", ")
              : "";
            return (
              <li key={`${opt.add ? "add" : "item"}-${opt.value}`} data-idx={i} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition-colors",
                    opt.add && "mt-1 border-t border-bone font-semibold text-saffron-dk",
                    isActive ? "bg-saffron/10 text-ink" : "text-ink hover:bg-cream"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{opt.label}</span>
                    {sub ? <span className="block truncate text-xs text-ash">{sub}</span> : null}
                  </span>
                  {isSelected ? <Check className="size-4 shrink-0 text-saffron-dk" /> : null}
                </button>
              </li>
            );
          })}
          {loading && merged.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-ash" aria-live="polite">
              Searching...
            </li>
          ) : options.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-ash">
              {trimmed
                ? "No matches. Keep typing to add your own."
                : source.kind === "startup"
                  ? "Type your startup name."
                  : "Type your institution name."}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
