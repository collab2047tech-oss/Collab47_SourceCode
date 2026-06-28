"use client";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

/**
 * The rail's view of a single conversation. This is the cached shape the inbox
 * and every thread open read from - it never re-derives the conversation list
 * from the server on navigation. Seeded once from the server (the messages
 * layout) and reconciled in the background + via a single app-level realtime
 * subscription on the user's memberships.
 */
export interface RailConversation {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  /** Last message preview text (or an honest "Photo" / "Wants to connect"). */
  last: string;
  /** ISO timestamp of the last message - the rail formats it relatively. */
  lastMessageAt: string;
  unread: boolean;
  isGroup: boolean;
  isRequest: boolean;
}

interface InboxSnapshot {
  conversations: RailConversation[];
  requests: RailConversation[];
}

interface MessagesContextValue extends InboxSnapshot {
  /** Total unread across non-request conversations (for nav + tab badges). */
  unreadCount: number;
  /** Bump a conversation to the top with a fresh preview (own send / inbound). */
  bumpToTop: (
    id: string,
    patch: { last: string; lastMessageAt: string; unread?: boolean }
  ) => void;
  /** Clear a conversation's unread state (optimistic mark-read on thread open). */
  markConversationRead: (id: string) => void;
  /** Move a request into the main inbox (optimistic Accept). */
  moveRequestToInbox: (id: string) => void;
  /** Remove a conversation from both buckets (optimistic Decline / block-out). */
  removeConversation: (id: string) => void;
  /** Restore a previously removed conversation (rollback on failed Decline). */
  restoreConversation: (conv: RailConversation) => void;
}

const MessagesContext = createContext<MessagesContextValue | null>(null);

const SNAPSHOT_KEY = "c47:dm:inbox";

function readSnapshot(): InboxSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as InboxSnapshot;
    if (!Array.isArray(parsed.conversations) || !Array.isArray(parsed.requests)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(snap: InboxSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    /* sessionStorage may be unavailable (private mode); cache is best-effort. */
  }
}

function sortByRecency(list: RailConversation[]): RailConversation[] {
  return [...list].sort(
    (a, b) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
  );
}

/**
 * Reconcile a freshly seeded server list against the current local list without
 * clobbering optimistic edits. Server membership wins (rows dropped server-side
 * disappear; brand-new server rows are added), but when a local copy is FRESHER
 * than the incoming server row - its lastMessageAt is strictly newer, meaning a
 * realtime/optimistic path already advanced it - we keep the local preview
 * (last), timestamp (lastMessageAt) and unread flag so the re-seed cannot
 * out-race them. Identity-stable fields (name, handle, avatar, group/request
 * bucket) always take the authoritative server value. Ordering is normalized by
 * the existing sortByRecency.
 */
function mergeServerList(
  server: RailConversation[],
  local: RailConversation[]
): RailConversation[] {
  const localById = new Map(local.map((c) => [c.id, c]));
  const merged = server.map((serverConv) => {
    const localConv = localById.get(serverConv.id);
    if (!localConv) return serverConv;
    const localIsFresher =
      new Date(localConv.lastMessageAt).getTime() >
      new Date(serverConv.lastMessageAt).getTime();
    if (!localIsFresher) return serverConv;
    return {
      ...serverConv,
      last: localConv.last,
      lastMessageAt: localConv.lastMessageAt,
      unread: localConv.unread,
    };
  });
  return sortByRecency(merged);
}

export function MessagesProvider({
  initialConversations,
  initialRequests,
  currentUserId,
  children,
}: {
  initialConversations: RailConversation[];
  initialRequests: RailConversation[];
  currentUserId: string;
  children: React.ReactNode;
}) {
  // Seed from the freshest of (server props, sessionStorage). The server props
  // are authoritative for correctness; the snapshot only helps the FIRST paint
  // before this provider mounts (handled by the rail reading the same key).
  const [conversations, setConversations] = useState<RailConversation[]>(
    () => sortByRecency(initialConversations)
  );
  const [requests, setRequests] = useState<RailConversation[]>(
    () => sortByRecency(initialRequests)
  );

  // Reconcile when the server re-seeds (e.g. a hard navigation / revalidate).
  // We trust the server list for membership but keep our optimistic unread/last
  // edits from out-racing it by merging only NEW conversations + fresher rows.
  // The functional updater reads the live local state so we can diff against it
  // without re-running the effect on every local edit.
  useEffect(() => {
    setConversations((prev) => mergeServerList(initialConversations, prev));
  }, [initialConversations]);
  useEffect(() => {
    setRequests((prev) => mergeServerList(initialRequests, prev));
  }, [initialRequests]);

  // Persist a snapshot so the NEXT inbox open paints from cache instantly.
  useEffect(() => {
    writeSnapshot({ conversations, requests });
  }, [conversations, requests]);

  const bumpToTop = useCallback<MessagesContextValue["bumpToTop"]>(
    (id, patch) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        const [conv] = next.splice(idx, 1);
        next.unshift({
          ...conv,
          last: patch.last,
          lastMessageAt: patch.lastMessageAt,
          unread: patch.unread ?? conv.unread,
        });
        return next;
      });
      // A request thread receiving a new message also bubbles inside Requests.
      setRequests((prev) => {
        const idx = prev.findIndex((c) => c.id === id);
        if (idx === -1) return prev;
        const next = [...prev];
        const [conv] = next.splice(idx, 1);
        next.unshift({
          ...conv,
          last: patch.last,
          lastMessageAt: patch.lastMessageAt,
          unread: patch.unread ?? conv.unread,
        });
        return next;
      });
    },
    []
  );

  const markConversationRead = useCallback<
    MessagesContextValue["markConversationRead"]
  >((id) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c))
    );
    setRequests((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: false } : c))
    );
  }, []);

  const moveRequestToInbox = useCallback<
    MessagesContextValue["moveRequestToInbox"]
  >((id) => {
    setRequests((prev) => {
      const conv = prev.find((c) => c.id === id);
      if (conv) {
        setConversations((inbox) =>
          inbox.some((c) => c.id === id)
            ? inbox
            : sortByRecency([{ ...conv, isRequest: false }, ...inbox])
        );
      }
      return prev.filter((c) => c.id !== id);
    });
  }, []);

  const removeConversation = useCallback<
    MessagesContextValue["removeConversation"]
  >((id) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setRequests((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const restoreConversation = useCallback<
    MessagesContextValue["restoreConversation"]
  >((conv) => {
    if (conv.isRequest) {
      setRequests((prev) =>
        prev.some((c) => c.id === conv.id) ? prev : sortByRecency([conv, ...prev])
      );
    } else {
      setConversations((prev) =>
        prev.some((c) => c.id === conv.id) ? prev : sortByRecency([conv, ...prev])
      );
    }
  }, []);

  // ONE app-level realtime subscription on the user's memberships keeps the rail
  // last-message + unread live even when no thread is open (WhatsApp behavior).
  // The open thread has its own per-conversation channel for the message list;
  // here we only update the rail preview. We resubscribe when the membership set
  // changes (a new conversation appears in either bucket).
  const convIdsKey = useMemo(
    () => [...conversations, ...requests].map((c) => c.id).sort().join(","),
    [conversations, requests]
  );
  const currentPathRef = useRef<string>("");
  useEffect(() => {
    currentPathRef.current =
      typeof window !== "undefined" ? window.location.pathname : "";
  });

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const ids = convIdsKey ? convIdsKey.split(",") : [];
    if (ids.length === 0) return;
    const idSet = new Set(ids);

    const channel = sb
      .channel("dm:rail")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new as {
            conversation_id: string;
            sender_id: string;
            body: string | null;
            image_url: string | null;
            is_request: boolean;
            created_at: string;
          };
          if (!idSet.has(row.conversation_id)) return;
          const fromMe = row.sender_id === currentUserId;
          const preview =
            row.body ||
            (row.is_request ? "Wants to connect" : row.image_url ? "Photo" : "");
          // If the user is currently viewing this exact thread, it is already
          // being marked read by the thread; do not flip unread back on.
          const viewingThis =
            currentPathRef.current === `/messages/${row.conversation_id}`;
          bumpToTop(row.conversation_id, {
            last: preview,
            lastMessageAt: row.created_at,
            unread: fromMe || viewingThis ? false : true,
          });
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [convIdsKey, currentUserId, bumpToTop]);

  const unreadCount = useMemo(
    () => conversations.reduce((n, c) => n + (c.unread ? 1 : 0), 0),
    [conversations]
  );

  const value: MessagesContextValue = {
    conversations,
    requests,
    unreadCount,
    bumpToTop,
    markConversationRead,
    moveRequestToInbox,
    removeConversation,
    restoreConversation,
  };

  return (
    <MessagesContext.Provider value={value}>{children}</MessagesContext.Provider>
  );
}

/**
 * Read the messages cache. Returns null OUTSIDE a MessagesProvider so optional
 * consumers (e.g. an optimistic button rendered on a non-provider page) can
 * degrade gracefully instead of throwing.
 */
export function useMessagesStore(): MessagesContextValue | null {
  return useContext(MessagesContext);
}

/** Read the cached snapshot synchronously (for first-paint before mount). */
export function readInboxSnapshot(): InboxSnapshot | null {
  return readSnapshot();
}
