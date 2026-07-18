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
import { markReadAction, loadEarlierAction } from "@/app/(app)/messages/actions";
import { useMessagesStore } from "@/components/messages/MessagesProvider";
import type { MessageWithSender, MiniProfile } from "@/lib/db/messages";

/**
 * A message in the thread is either a confirmed server/realtime row or an
 * optimistic temp the local user just sent. Temps carry a clientId + a status
 * and a synthetic created_at; they are reconciled (or rolled back) by the send
 * result and the realtime echo, matched on client_id.
 */
export interface ThreadMessage extends MessageWithSender {
  /** Present only on optimistic temp messages not yet confirmed by the server. */
  status?: "sending" | "failed";
  /** Local preview object-URL for an image still uploading (temp only). */
  localImageUrl?: string;
  /** Human reason shown on a failed bubble (rate-limit / moderation / block / network). */
  failReason?: string;
  /** True when a retry can never succeed (permission block / moderation): Retry is hidden. */
  failPermanent?: boolean;
}

interface SendArgs {
  clientId: string;
  body: string;
  localImageUrl?: string;
}

interface ThreadContextValue {
  messages: ThreadMessage[];
  /** The id of the most recent OWN message the other party has read ("Seen"). */
  lastSeenOwnId: string | null;
  /** Push an optimistic temp bubble (called by the composer before awaiting). */
  pushOptimistic: (args: SendArgs) => void;
  /** Mark a temp confirmed - the realtime echo finalizes it; drop on match. */
  confirmOptimistic: (clientId: string) => void;
  /**
   * Flip a temp to the failed state. `reason` is surfaced on the bubble; when
   * `permanent` is true (permission block / moderation) the Retry affordance is
   * suppressed, since re-sending the identical payload can never succeed.
   */
  failOptimistic: (clientId: string, reason?: string, permanent?: boolean) => void;
  /** Flip a failed temp back to "sending" (optimistic retry) so it stops reading as not-delivered. */
  retryOptimistic: (clientId: string) => void;
  /** Whether the composer's blocked footer should show (ChatMenu block toggle). */
  blockedByMenu: boolean;
  setBlockedByMenu: (blocked: boolean) => void;
  /** Load the older page above; returns true if more may still exist. */
  loadEarlier: () => Promise<boolean>;
  hasMore: boolean;
  loadingEarlier: boolean;
}

const ThreadContext = createContext<ThreadContextValue | null>(null);

function sortAsc(list: ThreadMessage[]): ThreadMessage[] {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// ── Unsent-temp persistence ──────────────────────────────────────────────────
// Optimistic temps live only in memory, so a message that is still sending (or
// failed) when the user navigates away is otherwise destroyed silently. We
// persist unconfirmed temps per-conversation to localStorage and restore them
// (as failed, since any in-flight send died with the page) on the next mount, so
// the user never loses a message behind a navigation.
const UNSENT_PREFIX = "c47:dm:unsent:";
// Cap the persisted image preview so a large data-URL can never blow the
// localStorage quota; over the cap we keep the text + failed state, drop preview.
const MAX_PERSISTED_PREVIEW = 700_000;

interface PersistedTemp {
  clientId: string;
  body: string;
  created_at: string;
  localImageUrl?: string;
  failReason?: string;
  failPermanent?: boolean;
  /** Whether the temp carried an image; its File cannot survive a reload. */
  hadImage?: boolean;
}

function unsentKey(conversationId: string): string {
  return `${UNSENT_PREFIX}${conversationId}`;
}

function readPersistedTemps(conversationId: string): PersistedTemp[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(unsentKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PersistedTemp[]) : [];
  } catch {
    return [];
  }
}

function writePersistedTemps(conversationId: string, temps: PersistedTemp[]) {
  if (typeof window === "undefined") return;
  try {
    if (temps.length === 0) {
      window.localStorage.removeItem(unsentKey(conversationId));
    } else {
      window.localStorage.setItem(unsentKey(conversationId), JSON.stringify(temps));
    }
  } catch {
    /* private mode / quota - persistence is best-effort. */
  }
}

export function ThreadProvider({
  conversationId,
  initialMessages,
  currentUserId,
  me,
  children,
}: {
  conversationId: string;
  initialMessages: MessageWithSender[];
  currentUserId: string;
  /** The current user's own profile, so own-echoes need no profile round trip. */
  me: MiniProfile | null;
  children: React.ReactNode;
}) {
  const store = useMessagesStore();
  const [messages, setMessages] = useState<ThreadMessage[]>(() => {
    const base = sortAsc(initialMessages as ThreadMessage[]);
    // Restore any unsent/failed temps left behind by a previous navigation,
    // skipping ones the server has since confirmed (same client_id already real).
    const persisted = readPersistedTemps(conversationId);
    if (persisted.length === 0) return base;
    const realClientIds = new Set(
      base.map((m) => m.client_id).filter((id): id is string => !!id)
    );
    const meFallback: MiniProfile = {
      id: currentUserId,
      handle: "",
      name: "You",
      avatar_url: null,
      college: null,
    };
    const restored: ThreadMessage[] = persisted
      .filter((t) => t.clientId && !realClientIds.has(t.clientId))
      .map((t) => ({
        id: `temp:${t.clientId}`,
        conversation_id: conversationId,
        sender_id: currentUserId,
        body: t.body,
        image_url: null,
        is_request: false,
        read_at: null,
        created_at: t.created_at,
        client_id: t.clientId,
        sender: meFallback,
        // An interrupted "sending" temp cannot still be in flight after a
        // reload - restore it as failed so it is never lost. Text is retryable;
        // an image's File cannot survive a reload, so an image temp is shown but
        // its Retry is suppressed (a retry that drops the image would be
        // dishonest).
        status: "failed" as const,
        localImageUrl: t.localImageUrl,
        failReason:
          t.failReason ?? (t.hadImage ? "Photo not delivered." : "Not delivered."),
        failPermanent: Boolean(t.failPermanent) || Boolean(t.hadImage),
      }));
    return sortAsc([...base, ...restored]);
  });
  const [blockedByMenu, setBlockedByMenu] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 50);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  // Cache of sender profiles seen so far so group inbound messages need at most
  // one profile fetch per never-before-seen sender (own + known are free).
  const profileCacheRef = useRef<Map<string, MiniProfile>>(new Map());
  useEffect(() => {
    const cache = profileCacheRef.current;
    if (me) cache.set(me.id, me);
    for (const m of initialMessages) {
      if (m.sender) cache.set(m.sender.id, m.sender);
    }
  }, [initialMessages, me]);

  // Reconcile fresh server data if the route re-seeds (hard nav). Adds only
  // genuinely new rows + replaces any temp whose client_id now has a real row.
  useEffect(() => {
    setMessages((prev) => {
      const realByClientId = new Map<string, MessageWithSender>();
      for (const m of initialMessages) {
        if (m.client_id) realByClientId.set(m.client_id, m);
      }
      const seenIds = new Set(prev.map((m) => m.id));
      // Drop any optimistic temp (synthetic "temp:" id) that now has a confirmed
      // server row with the same client_id, regardless of its sending status.
      const kept = prev.filter(
        (m) =>
          !(
            m.id.startsWith("temp:") &&
            m.client_id &&
            realByClientId.has(m.client_id)
          )
      );
      const keptIds = new Set(kept.map((m) => m.id));
      const added = initialMessages.filter((m) => !keptIds.has(m.id) && !seenIds.has(m.id));
      if (added.length === 0 && kept.length === prev.length) return prev;
      return sortAsc([...kept, ...(added as ThreadMessage[])]);
    });
  }, [initialMessages]);

  const pushOptimistic = useCallback<ThreadContextValue["pushOptimistic"]>(
    ({ clientId, body, localImageUrl }) => {
      const meProfile =
        profileCacheRef.current.get(currentUserId) ??
        ({
          id: currentUserId,
          handle: "",
          name: "You",
          avatar_url: null,
          college: null,
        } as MiniProfile);
      const temp: ThreadMessage = {
        id: `temp:${clientId}`,
        conversation_id: conversationId,
        sender_id: currentUserId,
        body,
        image_url: null,
        is_request: false,
        read_at: null,
        created_at: new Date().toISOString(),
        client_id: clientId,
        sender: meProfile,
        status: "sending",
        localImageUrl,
      };
      setMessages((prev) => sortAsc([...prev, temp]));
    },
    [conversationId, currentUserId]
  );

  const confirmOptimistic = useCallback<ThreadContextValue["confirmOptimistic"]>(
    (clientId) => {
      // The realtime echo will replace the temp with the real row (matched on
      // client_id). If the echo already arrived, the temp is gone; if not, the
      // temp simply loses its "sending" state so it stops spinning.
      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === clientId && m.status
            ? { ...m, status: undefined }
            : m
        )
      );
    },
    []
  );

  const failOptimistic = useCallback<ThreadContextValue["failOptimistic"]>(
    (clientId, reason, permanent) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === clientId
            ? {
                ...m,
                status: "failed",
                failReason: reason ?? m.failReason ?? "Not delivered.",
                failPermanent: permanent ?? false,
              }
            : m
        )
      );
    },
    []
  );

  const retryOptimistic = useCallback<ThreadContextValue["retryOptimistic"]>(
    (clientId) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.client_id === clientId
            ? { ...m, status: "sending", failReason: undefined, failPermanent: undefined }
            : m
        )
      );
    },
    []
  );

  const loadEarlier = useCallback<ThreadContextValue["loadEarlier"]>(async () => {
    if (loadingEarlier || !hasMore) return hasMore;
    const oldest = messages.find((m) => !m.status);
    if (!oldest) return false;
    setLoadingEarlier(true);
    try {
      const older = await loadEarlierAction(conversationId, oldest.created_at);
      if (older.length < 50) setHasMore(false);
      if (older.length > 0) {
        for (const m of older) {
          if (m.sender) profileCacheRef.current.set(m.sender.id, m.sender);
        }
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const fresh = (older as ThreadMessage[]).filter((m) => !ids.has(m.id));
          return sortAsc([...fresh, ...prev]);
        });
      }
      return older.length >= 50;
    } finally {
      setLoadingEarlier(false);
    }
  }, [conversationId, messages, hasMore, loadingEarlier]);

  // Persist unconfirmed temps (sending/failed) so they survive navigation, and
  // clear them the instant they reconcile (status cleared or temp replaced by a
  // real row). Keyed per-conversation; runs after every message change.
  useEffect(() => {
    const temps: PersistedTemp[] = messages
      .filter(
        (m) =>
          m.id.startsWith("temp:") &&
          !!m.client_id &&
          (m.status === "sending" || m.status === "failed")
      )
      .map((m) => {
        const preview =
          m.localImageUrl && m.localImageUrl.length <= MAX_PERSISTED_PREVIEW
            ? m.localImageUrl
            : undefined;
        return {
          clientId: m.client_id as string,
          body: m.body ?? "",
          created_at: m.created_at,
          localImageUrl: preview,
          failReason: m.failReason,
          failPermanent: m.failPermanent,
          hadImage: !!m.localImageUrl,
        };
      });
    writePersistedTemps(conversationId, temps);
  }, [messages, conversationId]);

  // Realtime: INSERT (new messages, including our own echo) + UPDATE (read_at).
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;

    const channel = sb
      .channel(`messages:conversation_id=eq.${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const newMsg = payload.new as MessageWithSender & { client_id: string | null };

          // Resolve the sender profile WITHOUT a round trip when we can: own
          // messages + any sender already seen come from the local cache.
          let sender = profileCacheRef.current.get(newMsg.sender_id) ?? null;
          if (!sender) {
            const { data } = await sb
              .from("profiles")
              .select("id, handle, name, avatar_url, college")
              .eq("id", newMsg.sender_id)
              .maybeSingle();
            sender =
              (data as MiniProfile | null) ?? {
                id: newMsg.sender_id,
                handle: "",
                name: "Unknown",
                avatar_url: null,
                college: null,
              };
            profileCacheRef.current.set(newMsg.sender_id, sender);
          }

          const real: ThreadMessage = { ...newMsg, sender };

          setMessages((prev) => {
            // De-dupe by real id.
            if (prev.some((m) => m.id === real.id)) return prev;
            // Reconcile: a not-yet-finalized temp (synthetic "temp:" id) with
            // the same client_id becomes this real row, preserving order. This
            // is independent of the temp's status, so the echo finalizes the
            // bubble whether or not the action result already cleared its
            // "sending" spinner (no duplicate row either way).
            const tempIdx = newMsg.client_id
              ? prev.findIndex(
                  (m) =>
                    m.id.startsWith("temp:") && m.client_id === newMsg.client_id
                )
              : -1;
            if (tempIdx !== -1) {
              const next = [...prev];
              next[tempIdx] = real;
              return sortAsc(next);
            }
            return sortAsc([...prev, real]);
          });

          if (newMsg.sender_id !== currentUserId) {
            markReadAction(conversationId);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as MessageWithSender;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === updated.id ? { ...m, ...updated, sender: m.sender } : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  // Mark read on mount + when the tab regains focus. Clears the rail dot + nav
  // badge optimistically (markConversationRead) while the server call persists.
  useEffect(() => {
    markReadAction(conversationId);
    store?.markConversationRead(conversationId);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        markReadAction(conversationId);
        store?.markConversationRead(conversationId);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // store identity is stable across renders; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const lastSeenOwnId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.sender_id === currentUserId && m.read_at) return m.id;
    }
    return null;
  }, [messages, currentUserId]);

  const value: ThreadContextValue = {
    messages,
    lastSeenOwnId,
    pushOptimistic,
    confirmOptimistic,
    failOptimistic,
    retryOptimistic,
    blockedByMenu,
    setBlockedByMenu,
    loadEarlier,
    hasMore,
    loadingEarlier,
  };

  return <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>;
}

export function useThread(): ThreadContextValue {
  const ctx = useContext(ThreadContext);
  if (!ctx) throw new Error("useThread must be used within a ThreadProvider");
  return ctx;
}
