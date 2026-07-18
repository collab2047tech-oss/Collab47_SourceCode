"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { cn } from "@/lib/cn";
import { Check, Search, Users, X } from "lucide-react";
import {
  createGroupAction,
  getGroupCandidatesAction,
} from "@/app/(app)/messages/actions";
import type { MiniProfile } from "@/lib/db/social";

interface NewGroupModalProps {
  open: boolean;
  onClose: () => void;
}

export function NewGroupModal({ open, onClose }: NewGroupModalProps) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<MiniProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dialogRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Load the connection pool. A failed fetch now sets a DISTINCT error state so
  // it no longer masquerades as "you have no connections" (which reads as a lie
  // to a user who actually has connections).
  const loadCandidates = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    getGroupCandidatesAction()
      .then((rows) => setCandidates(rows))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!open) return;
    loadCandidates();
  }, [open, loadCandidates]);

  // Reset transient state each time the modal closes.
  useEffect(() => {
    if (open) return;
    setSearch("");
    setName("");
    setSelected(new Set());
    setError(null);
    setLoadError(false);
  }, [open]);

  // Dialog behaviour: focus the first field on open, close on Escape, and trap
  // Tab within the panel so keyboard focus cannot wander behind the modal.
  useEffect(() => {
    if (!open) return;
    const focusTimer = setTimeout(() => nameInputRef.current?.focus(), 0);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const filtered = search.trim()
    ? candidates.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.handle.toLowerCase().includes(search.toLowerCase())
      )
    : candidates;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Give your group a name.");
      return;
    }
    if (selected.size < 1) {
      setError("Pick at least one person.");
      return;
    }
    startTransition(async () => {
      const result = await createGroupAction(name.trim(), Array.from(selected));
      if (result.ok && result.conversationId) {
        onClose();
        router.push(`/messages/${result.conversationId}`);
        router.refresh();
      } else {
        setError(result.error ?? "Could not create the group.");
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-ink/40 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-group-title"
        className="flex h-full w-full flex-col overflow-hidden border-bone bg-paper shadow-xl sm:h-auto sm:max-h-[80vh] sm:max-w-md sm:rounded-2xl sm:border"
      >
        <header className="flex items-center justify-between border-b border-bone px-5 py-4">
          <div className="flex items-center gap-2">
            <Users className="size-5 text-saffron" />
            <h3 id="new-group-title" className="font-serif text-xl text-ink">New group</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 items-center justify-center rounded-full text-ash transition-colors hover:bg-bone hover:text-ink active:scale-90"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="border-b border-bone px-5 py-4">
          <input
            ref={nameInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Group name"
            aria-label="Group name"
            maxLength={80}
            className="w-full rounded-lg border border-bone bg-cream px-4 py-2.5 text-sm text-ink outline-none placeholder:text-ash focus:border-saffron"
          />
          <div className="mt-3 flex items-center gap-2 rounded-full border border-bone bg-cream px-4 py-2">
            <Search className="size-4 shrink-0 text-ash" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search connections"
              className="w-full bg-transparent text-sm outline-none placeholder:text-ash"
            />
          </div>
          {selected.size > 0 && (
            <p className="mt-2 text-xs text-ash">
              {selected.size} selected
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <p className="px-5 py-10 text-center text-sm text-ash">Loading…</p>
          )}
          {!loading && loadError && (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <Users className="size-8 text-bone" />
              <p className="text-sm text-ash">
                Could not load your connections. Check your connection and try again.
              </p>
              <button
                type="button"
                onClick={loadCandidates}
                className="rounded-full border border-bone px-4 py-2 text-xs font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
              >
                Try again
              </button>
            </div>
          )}
          {!loading && !loadError && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Users className="size-8 text-bone" />
              <p className="text-sm text-ash">
                {candidates.length === 0
                  ? "Connect with people to start a group."
                  : "No matches."}
              </p>
            </div>
          )}
          {!loading &&
            !loadError &&
            filtered.map((c) => {
              const isSelected = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-bone/40 active:bg-bone/60",
                    isSelected && "bg-saffron/5"
                  )}
                >
                  <Avatar name={c.name} src={c.avatar_url ?? undefined} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                    <p className="truncate text-xs text-ash">@{c.handle}</p>
                  </div>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors",
                      isSelected
                        ? "border-saffron bg-saffron text-cream"
                        : "border-bone bg-cream"
                    )}
                  >
                    {isSelected && <Check className="size-3" />}
                  </span>
                </button>
              );
            })}
        </div>

        <footer className="border-t border-bone px-5 py-4">
          {error && <p className="mb-2 text-sm text-ember">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={isPending}>
              {isPending ? "Creating…" : "Create group"}
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
