"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { INDIAN_COLLEGES } from "@/lib/data/colleges";
import { cn } from "@/lib/cn";
import { Check, ChevronDown, Search } from "lucide-react";

interface CollegeComboboxProps {
  /** Current committed value (either a listed institution or free text). */
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Retained for call compatibility; free text is now typed directly into the
   *  main field, so there is no separate "Other" input to placeholder. */
  otherPlaceholder?: string;
  autoFocus?: boolean;
}

/**
 * Accessible combobox over real Indian institutions (INDIAN_COLLEGES) with a
 * type-to-filter dropdown, keyboard navigation, and first-class free text.
 *
 * Root-cause fix (founder-reported "onboarding still broken"): previously typing
 * only updated a local `query` while the committed `value` changed ONLY on an
 * option click / Enter-on-option. So a user could type their institute, SEE the
 * text in the field, yet `value` stayed "" and Continue sat silently disabled.
 * Now the typed text IS the value (`value` updates on every keystroke), the
 * curated list simply refines/replaces it on selection, and an explicit
 * "Use ..." row keeps the add-your-own affordance discoverable. There is no
 * hidden distinction between what the field shows and what the form stores.
 */
export function CollegeCombobox({
  value,
  onChange,
  label = "Institution",
  placeholder = "Search your institution",
  autoFocus,
}: CollegeComboboxProps) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const trimmed = value.trim();
  const q = trimmed.toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return INDIAN_COLLEGES.slice(0, 60);
    return INDIAN_COLLEGES.filter((c) => c.toLowerCase().includes(q)).slice(0, 60);
  }, [q]);

  // Is what they typed already an exact list entry? If so we do not need the
  // extra "use your own" row (the value is a real listed institution).
  const exactInList = useMemo(
    () => INDIAN_COLLEGES.some((c) => c.toLowerCase() === q),
    [q]
  );
  const showAddOwn = trimmed.length > 0 && !exactInList;

  // options = filtered institutions, then an explicit free-text affordance last.
  const options = useMemo(
    () => [
      ...filtered.map((c) => ({ value: c, label: c, add: false })),
      ...(showAddOwn ? [{ value: trimmed, label: `Use "${trimmed}"`, add: true }] : []),
    ],
    [filtered, showAddOwn, trimmed]
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
      // Enter selects the highlighted option only when the list is open. When
      // it is closed the typed value already stands, so we do nothing here and
      // let the parent step's Enter-to-advance take over.
      if (open && options[active]) {
        e.preventDefault();
        commit(options[active].value);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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
                  <span className="truncate">{opt.label}</span>
                  {isSelected ? <Check className="size-4 shrink-0 text-saffron-dk" /> : null}
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && !showAddOwn ? (
            <li className="px-3.5 py-3 text-sm text-ash">
              Type your institute name to add it.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
