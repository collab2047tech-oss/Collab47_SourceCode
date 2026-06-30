"use client";

import { getSupabaseBrowser } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Live post counts - a single module-level manager (NOT React context).
//
// Why a singleton, not a Provider: a context-based provider only works for
// cards rendered inside its subtree, and any wiring mistake (or a card on a
// page outside the provider - /p, /u) silently disables live counts. This
// manager is global: ANY PostCard anywhere calls subscribePostCounts() and gets
// updates, with zero provider/tree dependency. It runs BOTH:
//   1. Supabase Realtime (instant) - UPDATE events on posts.
//   2. A 6s polling backstop - refetches the authoritative counts for the posts
//      currently on screen, so counts are NEVER frozen even if the WebSocket
//      fails to deliver (proxies, blocked WS, token timing on prod).
// ---------------------------------------------------------------------------

export interface PostCounts {
  like_count: number;
  comment_count: number;
  repost_count: number;
  bookmark_count: number;
}

type Listener = (counts: PostCounts) => void;

const listeners = new Map<string, Set<Listener>>();
let started = false;

function emit(id: string, row: Partial<PostCounts>) {
  const set = listeners.get(id);
  if (!set || set.size === 0) return;
  const counts: PostCounts = {
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    repost_count: row.repost_count ?? 0,
    bookmark_count: row.bookmark_count ?? 0,
  };
  for (const cb of set) cb(counts);
}

function start() {
  if (started) return;
  const sb = getSupabaseBrowser();
  if (!sb) return;
  started = true;

  // 1. Realtime (instant when the socket delivers).
  sb.channel("post-counts-global")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "posts" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (payload: any) => {
        const row = payload?.new;
        if (row?.id) emit(row.id as string, row as Partial<PostCounts>);
      }
    )
    .subscribe();

  // 2. Polling backstop every 6s for the posts currently on screen.
  const poll = async () => {
    const ids = [...listeners.keys()];
    if (ids.length === 0) return;
    const { data } = await sb
      .from("posts")
      .select("id, like_count, comment_count, repost_count, bookmark_count")
      .in("id", ids.slice(0, 300));
    for (const r of (data ?? []) as Array<{ id: string } & Partial<PostCounts>>) {
      emit(r.id, r);
    }
  };
  setInterval(poll, 6000);
  // Kick once shortly after mount so a stale first paint corrects fast.
  setTimeout(poll, 1500);
}

/** Subscribe a card to live counts for one post. Returns an unsubscribe fn. */
export function subscribePostCounts(postId: string, cb: Listener): () => void {
  start();
  let set = listeners.get(postId);
  if (!set) {
    set = new Set();
    listeners.set(postId, set);
  }
  set.add(cb);
  return () => {
    const s = listeners.get(postId);
    if (!s) return;
    s.delete(cb);
    if (s.size === 0) listeners.delete(postId);
  };
}
