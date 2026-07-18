"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * LinkedIn-style post overlay. Rendered ONLY by the intercepted route
 * (`app/(app)/@modal/(.)p/[short_id]`), so the feed underneath stays mounted and
 * its scroll position is preserved for free - this component just locks body
 * scroll and traps focus while it is open.
 *
 * Close = X button / Escape / backdrop click -> router.back(), which pops the
 * intercepting route so the URL returns to wherever the user was (the post URL
 * remains shareable while open). Browser Back closes it the same way.
 *
 * Entrance is CSS-driven (`.c47-modal-*` in globals.css); the global
 * prefers-reduced-motion safety net collapses it to instant.
 */
export function PostModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    // Remember the element that opened the modal so focus can return to it.
    const trigger = document.activeElement as HTMLElement | null;

    // Lock body scroll (freezes the feed behind the overlay).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog (SR announces the dialog + its label).
    const focusTimer = window.setTimeout(() => panelRef.current?.focus(), 0);

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab") return;

      // Focus trap: keep Tab / Shift+Tab cycling within the dialog.
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === panel);
      if (focusables.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || active === panel || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      // Return focus to whatever opened the modal.
      if (trigger && typeof trigger.focus === "function") trigger.focus();
    };
  }, [close]);

  return (
    <div
      className="c47-modal-backdrop fixed inset-0 z-[70] flex items-stretch justify-center bg-ink/40 backdrop-blur-sm lg:items-center lg:p-6"
      // Backdrop click (mousedown started on the backdrop itself) closes.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Post"
        tabIndex={-1}
        className="c47-modal-panel relative flex w-[min(1080px,100%)] flex-col overflow-hidden bg-paper outline-none lg:h-auto lg:max-h-[85vh] lg:max-w-[1080px] lg:rounded-2xl lg:border lg:border-bone lg:shadow-2xl lg:shadow-ink/20"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close post"
          className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full bg-paper/90 text-ash backdrop-blur-sm transition-colors hover:bg-bone hover:text-ink active:scale-95"
        >
          <X className="size-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
