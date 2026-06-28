"use client";

import { useEffect, useRef } from "react";
import { recordProfileViewAction } from "@/app/u/[handle]/view-actions";

/**
 * Fire-and-forget profile view recorder. Mounts once on the visitor page and
 * records that the current viewer looked at `targetId`. Dedup-per-day + self-skip
 * are handled server-side; this just triggers the RPC. Renders nothing.
 */
export function ProfileViewTracker({ targetId }: { targetId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void recordProfileViewAction(targetId);
  }, [targetId]);

  return null;
}
