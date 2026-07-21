"use client";

import { useCallback, useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Optional wider size for editors that need room (banner reposition stage). */
  size?: "md" | "lg";
  /** Optional footer pinned below the scroll area (e.g. Save / Cancel). */
  footer?: React.ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal shell used by the inline profile editors.
 *
 * - role="dialog" + aria-modal + aria-labelledby
 * - Escape closes; backdrop click closes; the panel never closes on inner clicks
 * - Body scroll lock while open
 * - Focus trap (Tab cycles inside), focus moves in on open and is restored to
 *   the opener on close, so the user is never trapped and never lost
 * - No entrance transform under prefers-reduced-motion (handled via CSS var-free
 *   utility classes that the global reduced-motion safety net already governs)
 */
export function Modal({ title, onClose, children, size = "md", footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Remember what was focused before the modal opened so we can restore it.
  const openerRef = useRef<HTMLElement | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  useEffect(() => {
    openerRef.current = (document.activeElement as HTMLElement) ?? null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the panel (first focusable, else the panel itself).
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      // Restore focus to the element that opened the modal.
      openerRef.current?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-60 flex items-end justify-center bg-ink/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => {
        // Close only when the backdrop itself is pressed (not a drag ending here).
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-bone bg-paper shadow-xl outline-none sm:rounded-2xl",
          size === "lg" ? "max-w-2xl" : "max-w-xl",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-bone px-6 py-4">
          <h2
            id={titleId}
            className="font-serif text-xl leading-[1.16] text-ink"
            style={{ letterSpacing: "-0.01em" }}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-ash transition-colors hover:bg-bone hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            <X className="size-5" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-bone bg-cream/40 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
