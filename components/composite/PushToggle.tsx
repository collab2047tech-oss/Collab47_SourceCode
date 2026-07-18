"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { enablePush, disablePush, isPushEnabled, pushSupported } from "@/lib/push/client";

/**
 * Device-level web-push control. One browser = one subscription; the per-event
 * rows below just refine what a subscribed device gets. Kept self-contained so
 * it drops into the Notifications settings with a single line.
 */
export function PushToggle() {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) isPushEnabled().then(setEnabled);
  }, []);

  if (supported === false) {
    return (
      <p className="rounded-xl border border-bone bg-cream px-4 py-3 text-sm text-ash">
        This browser does not support push notifications. On iPhone, add Collab47 to your Home Screen first.
      </p>
    );
  }

  async function toggle() {
    setBusy(true);
    setMsg(null);
    try {
      if (enabled) {
        await disablePush();
        setEnabled(false);
      } else {
        const res = await enablePush();
        if (res.ok) {
          setEnabled(true);
        } else if (res.reason === "denied") {
          setMsg("Notifications are blocked. Allow them for collab47.com in your browser settings.");
        } else {
          setMsg("Could not enable push on this device. Try again.");
        }
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-bone bg-paper p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-saffron">{enabled ? <Bell className="size-5" /> : <BellOff className="size-5" />}</span>
          <div>
            <p className="text-sm font-semibold text-ink">Push notifications on this device</p>
            <p className="text-xs text-ash">Get alerted about messages, comments and connections even when Collab47 is closed.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-saffron focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-paper disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {enabled ? "Turn off" : "Enable"}
        </button>
      </div>
      {msg ? <p className="mt-3 text-xs text-ember">{msg}</p> : null}
    </div>
  );
}
