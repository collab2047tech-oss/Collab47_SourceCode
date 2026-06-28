"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INDIAN_COLLEGES } from "@/lib/data/colleges";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Pencil, Search } from "lucide-react";

const OTHER = "__other__";

interface CollegeComboboxProps {
  /** Current committed value (either a listed institution or free text). */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Placeholder for the free-text "Other" input. */
  otherPlaceholder?: string;
  autoFocus?: boolean;
}

/**
 * Accessible combobox over real Indian institutions (INDIAN_COLLEGES) with a
 * type-to-filter dropdown, keyboard navigation, and an always-available
 * "Other (type your own)" option for any institution not on the curated list.
 * Never invents institution names - all options come from real data or the
 * user's own free-text entry.
 */
export function CollegeCombobox({
  value,
  onChange,
  label = "Institution",
  placeholder = "Search your institution",
  otherPlaceholder = "Type your institution name",
  autoFocus,
}: CollegeComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // "Other" mode = a free-text value that is not on the curated list.
  const [otherMode, setOtherMode] = useState(
    value !== "" && !INDIAN_COLLEGES.includes(value)
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_COLLEGES.slice(0, 60);
    return INDIAN_COLLEGES.filter((c) => c.toLowerCase().includes(q)).slice(0, 60);
  }, [query]);

  // options = filtered institutions, then the "Other" affordance pinned last.
  const options = useMemo(
    () => [...filtered.map((c) => ({ value: c, label: c })), { value: OTHER, label: "Other (type your own)" }],
    [filtered]
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

  function commit(option: string) {
    if (option === OTHER) {
      setOtherMode(true);
      setOpen(false);
      onChange("");
      // Focus the free-text input on the next paint.
      requestAnimationFrame(() => {
        rootRef.current?.querySelector<HTMLInputElement>("[data-other-input]")?.focus();
      });
      return;
    }
    onChange(option);
    setQuery("");
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
      if (open && options[active]) {
        e.preventDefault();
        commit(options[active].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // --- Free-text "Other" mode ----------------------------------------------
  if (otherMode) {
    return (
      <div className="flex w-full flex-col gap-2" ref={rootRef}>
        <label className="text-caption text-ink">{label}</label>
        <div className="relative">
          <Pencil className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
          <input
            data-other-input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={otherPlaceholder}
            autoFocus={autoFocus}
            className="h-14 w-full rounded-lg border border-ink/15 bg-paper pl-11 pr-4 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus:ring-2 focus:ring-saffron/20"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setOtherMode(false);
            onChange("");
            setQuery("");
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
          className="self-start text-sm font-medium text-saffron-dk underline underline-offset-2 hover:text-saffron"
        >
          Back to search the list
        </button>
      </div>
    );
  }

  // --- Search / select mode -------------------------------------------------
  const selected = value && INDIAN_COLLEGES.includes(value);

  return (
    <div className="flex w-full flex-col gap-2" ref={rootRef}>
      <label className="text-caption text-ink">{label}</label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ash" />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={open ? query : value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
            if (value) onChange("");
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
            const isOther = opt.value === OTHER;
            const isActive = i === active;
            const isSelected = !isOther && opt.value === value;
            return (
              <li key={opt.value} data-idx={i} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(opt.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg px-3.5 py-3 text-left text-sm transition-colors",
                    isOther && "mt-1 border-t border-bone font-semibold text-saffron-dk",
                    isActive ? "bg-saffron/10 text-ink" : "text-ink hover:bg-cream"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected ? <Check className="size-4 shrink-0 text-saffron-dk" /> : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-ash">
              No match in the list. Use &quot;Other (type your own)&quot; above.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
