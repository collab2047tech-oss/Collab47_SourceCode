"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sendMessageAction } from "@/app/(app)/messages/actions";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useThread } from "@/components/messages/ThreadProvider";
import { useMessagesStore } from "@/components/messages/MessagesProvider";

interface MessageComposerProps {
  conversationId: string;
  /** Current user's id - stamped on typing broadcasts so peers can filter self. */
  currentUserId?: string;
  canCompose?: boolean;
  /** Reason shown when canCompose is false (e.g. you blocked / were blocked). */
  cannotComposeReason?: string;
}

const TYPING_DEBOUNCE_MS = 800;

/** A pending send's source data, kept so a failed send can be retried as-is. */
interface PendingPayload {
  body: string;
  file: File | null;
  localImageUrl?: string;
}

export function MessageComposer({
  conversationId,
  currentUserId,
  canCompose = true,
  cannotComposeReason,
}: MessageComposerProps) {
  const {
    messages,
    pushOptimistic,
    confirmOptimistic,
    failOptimistic,
    retryOptimistic,
    blockedByMenu,
  } = useThread();
  const store = useMessagesStore();
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [errorNote, setErrorNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Live view of the thread's messages so a retry can rebuild the payload for a
  // failed temp restored from storage (whose in-memory payload is gone).
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  // Keep each pending send's payload so a failed bubble can be retried with the
  // exact same clientId (deterministic reconciliation - no duplicate row).
  const pendingRef = useRef<Map<string, PendingPayload>>(new Map());

  // Maintain ONE subscribed channel for typing broadcasts. Sending on an
  // unsubscribed channel is dropped, so we subscribe up front and reuse it.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    const channel = sb.channel(`typing:${conversationId}`);
    channel.subscribe();
    typingChannelRef.current = channel;
    return () => {
      sb.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [conversationId]);

  function broadcastTyping() {
    typingChannelRef.current?.send({
      type: "broadcast",
      event: "typing",
      payload: { conversationId, userId: currentUserId },
    });
  }

  // Grow the textarea with its content up to a cap, then scroll internally.
  function autoGrow(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBody(e.target.value);
    autoGrow(e.target);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(broadcastTyping, TYPING_DEBOUNCE_MS);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      const isHeic =
        /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
      if (isHeic) {
        setImagePreview(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  /**
   * The actual network send, run OFF the critical path. The temp bubble is
   * already on screen by the time this runs. Uploads the image, calls the
   * action, then reconciles (confirm) or rolls the bubble to "failed".
   */
  const runSend = useCallback(
    async (clientId: string, payload: PendingPayload) => {
      const sb = getSupabaseBrowser();
      let image_url: string | undefined;

      if (payload.file && sb) {
        try {
          const toUpload = await prepareImageForUpload(payload.file);
          const ext = toUpload.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const path = `${conversationId}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.${ext}`;
          const { error } = await sb.storage
            .from("message-media")
            .upload(path, toUpload, { upsert: false });
          if (error) throw error;
          const { data } = sb.storage.from("message-media").getPublicUrl(path);
          image_url = data.publicUrl;
        } catch {
          // Image upload is transient (network / storage hiccup) - keep Retry.
          failOptimistic(
            clientId,
            "Image upload failed. Check your connection and retry.",
            false
          );
          setErrorNote("Image upload failed. Check your connection and retry.");
          return;
        }
      }

      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("body", payload.body);
      fd.set("client_id", clientId);
      if (image_url) fd.set("image_url", image_url);

      // The action call itself MUST be guarded: an unhandled rejection (network
      // drop, server exception) would otherwise leave the bubble spinning on
      // "Sending" forever - a silently lost message. On throw we flip it to a
      // retryable failed bubble instead.
      let result: Awaited<ReturnType<typeof sendMessageAction>>;
      try {
        result = await sendMessageAction(fd);
      } catch {
        failOptimistic(
          clientId,
          "Message not sent. Check your connection and retry.",
          false
        );
        setErrorNote("Message not sent. Check your connection and retry.");
        return;
      }

      if (result?.ok) {
        pendingRef.current.delete(clientId);
        confirmOptimistic(clientId);
        // Reorder the rail like WhatsApp; reconciled by the realtime echo too.
        store?.bumpToTop(conversationId, {
          last: payload.body || "Photo",
          lastMessageAt: new Date().toISOString(),
          unread: false,
        });
        if (result.isRequest) {
          setHint("Your message went to their requests.");
          setTimeout(() => setHint(null), 4000);
        }
      } else {
        // Surface the REAL reason for every failure and only offer Retry when it
        // could actually help: permission blocks and moderation are permanent.
        const reason =
          result?.blockedReason ??
          result?.error ??
          "Message not sent. Please try again.";
        const permanent = result?.permanent ?? Boolean(result?.blockedReason);
        failOptimistic(clientId, reason, permanent);
        setErrorNote(reason);
      }
    },
    [conversationId, confirmOptimistic, failOptimistic, store]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !imageFile) return;
    setErrorNote(null);

    const clientId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const text = body.trim();
    const file = imageFile;
    const localImageUrl = imagePreview ?? undefined;

    // INSTANT: render the temp bubble, clear the input, keep focus, scroll.
    pushOptimistic({ clientId, body: text, localImageUrl });
    pendingRef.current.set(clientId, { body: text, file, localImageUrl });
    setBody("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    removeImage();
    inputRef.current?.focus();

    // Background: upload + send + reconcile.
    void runSend(clientId, { body: text, file, localImageUrl });
  }

  // Retry a failed bubble (re-runs the same payload + clientId).
  useEffect(() => {
    function onRetry(e: Event) {
      const detail = (e as CustomEvent).detail as { clientId?: string };
      if (!detail?.clientId) return;
      let payload = pendingRef.current.get(detail.clientId);
      if (!payload) {
        // Failed temp restored from storage: its in-memory payload is gone, so
        // rebuild a text payload from the thread. The original File cannot
        // survive a reload, so an attached image is not re-uploaded.
        const msg = messagesRef.current.find(
          (m) => m.client_id === detail.clientId
        );
        if (!msg) return;
        payload = {
          body: msg.body ?? "",
          file: null,
          localImageUrl: msg.localImageUrl,
        };
      }
      setErrorNote(null);
      retryOptimistic(detail.clientId);
      void runSend(detail.clientId, payload);
    }
    window.addEventListener("c47:dm:retry", onRetry as EventListener);
    return () =>
      window.removeEventListener("c47:dm:retry", onRetry as EventListener);
  }, [runSend, retryOptimistic]);

  // Blocked from the menu (ChatMenu dispatches via ThreadProvider state).
  if (!canCompose || blockedByMenu) {
    return (
      <footer className="border-t border-bone bg-paper px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
        <p className="text-center text-sm text-ash">
          {blockedByMenu
            ? "You blocked this person. Unblock from the menu to message them."
            : cannotComposeReason ?? "You cannot message this person."}
        </p>
      </footer>
    );
  }

  return (
    <footer className="border-t border-bone bg-paper px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-6 sm:py-4">
      {errorNote && <p className="mb-2 text-sm text-ember">{errorNote}</p>}
      {hint && <p className="mb-2 text-sm text-ash">{hint}</p>}

      {imagePreview && (
        <div className="relative mb-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagePreview}
            alt="Attachment preview"
            className="max-h-24 rounded-lg border border-bone object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            aria-label="Remove image"
            className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-cream hover:bg-ash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {imageFile && !imagePreview && (
        <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-bone bg-cream px-3 py-2">
          <Paperclip className="size-3.5 text-ash" />
          <span className="max-w-48 truncate text-xs text-ink">
            {imageFile.name}
          </span>
          <button
            type="button"
            onClick={removeImage}
            aria-label="Remove attachment"
            className="rounded-full p-0.5 text-ash hover:bg-bone hover:text-ink"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="flex items-end gap-2 rounded-3xl border border-bone bg-cream py-1.5 pl-2 pr-1.5 transition-colors focus-within:border-saffron sm:gap-3 sm:py-2 sm:pl-3 sm:pr-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-ash transition-colors hover:text-ink active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
            title="Attach image"
            aria-label="Attach image"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={handleImageChange}
          />
          <textarea
            ref={inputRef}
            value={body}
            onChange={handleBodyChange}
            placeholder="Write a message"
            rows={1}
            aria-label="Write a message"
            className="max-h-32 w-full min-w-0 resize-none self-center bg-transparent py-2 text-sm leading-snug text-ink outline-none placeholder:text-ash no-scrollbar"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={!body.trim() && !imageFile}
            aria-label="Send message"
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full bg-saffron text-cream transition-all hover:bg-saffron-dk active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100"
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </footer>
  );
}
