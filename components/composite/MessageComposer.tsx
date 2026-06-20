"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { sendMessageAction } from "@/app/(app)/messages/actions";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface MessageComposerProps {
  conversationId: string;
  /** Current user's id — stamped on typing broadcasts so peers can filter self. */
  currentUserId?: string;
  canCompose?: boolean;
  blockedReason?: string;
  /** Reason shown when canCompose is false (e.g. you blocked / were blocked). */
  cannotComposeReason?: string;
}

const TYPING_DEBOUNCE_MS = 800;

export function MessageComposer({
  conversationId,
  currentUserId,
  canCompose = true,
  blockedReason,
  cannotComposeReason,
}: MessageComposerProps) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hint, setHint] = useState<string | null>(null);
  const [localBlockedReason, setLocalBlockedReason] = useState<string | null>(
    blockedReason ?? null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingChannelRef = useRef<RealtimeChannel | null>(null);

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

  function handleBodyChange(e: React.ChangeEvent<HTMLInputElement>) {
    setBody(e.target.value);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(broadcastTyping, TYPING_DEBOUNCE_MS);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setImageFile(file);
    if (file) {
      // HEIC/HEIF can't be rendered by browsers, so a data-URL preview shows a
      // broken image. Skip the inline preview for those — the file still
      // converts to JPEG and uploads fine on send.
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() && !imageFile) return;

    const sb = getSupabaseBrowser();

    startTransition(async () => {
      // Upload image CLIENT-SIDE to Storage; only the URL goes to the action.
      let image_url: string | undefined;
      if (imageFile && sb) {
        try {
          // Routes HEIC/HEIF (iPhone photos) -> JPEG and compresses all formats.
          const toUpload = await prepareImageForUpload(imageFile);
          const ext = toUpload.name.split(".").pop()?.toLowerCase() ?? "jpg";
          const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await sb.storage.from("message-media").upload(path, toUpload, { upsert: false });
          if (error) throw error;
          const { data } = sb.storage.from("message-media").getPublicUrl(path);
          image_url = data.publicUrl;
        } catch {
          setLocalBlockedReason("Image upload failed. Try a smaller file.");
          return;
        }
      }

      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("body", body.trim());
      if (image_url) fd.set("image_url", image_url);

      const result = await sendMessageAction(fd);

      if (result?.blockedReason) {
        setLocalBlockedReason(`Cannot send: ${result.blockedReason}`);
        return;
      }

      if (result?.ok) {
        setBody("");
        setImageFile(null);
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        if (result.isRequest) {
          setHint("Your message went to their requests.");
          setTimeout(() => setHint(null), 4000);
        } else {
          setHint(null);
        }
        setLocalBlockedReason(null);
        // Fallback in case realtime is unavailable: re-fetch the server
        // component so the just-sent message renders. Realtime INSERT handler
        // in MessageThread dedupes by id, so this never double-renders.
        router.refresh();
      }
    });
  }

  if (!canCompose) {
    return (
      <footer className="border-t border-bone bg-paper px-3 py-3 sm:px-6 sm:py-4">
        <p className="text-center text-sm text-ash">
          {cannotComposeReason ?? "You cannot message this person."}
        </p>
      </footer>
    );
  }

  if (localBlockedReason && !body && !imageFile) {
    return (
      <footer className="border-t border-bone bg-paper px-3 py-3 sm:px-6 sm:py-4">
        <p className="text-center text-sm text-ember">{localBlockedReason}</p>
      </footer>
    );
  }

  return (
    <footer className="border-t border-bone bg-paper px-3 py-3 sm:px-6 sm:py-4">
      {localBlockedReason && (
        <p className="mb-2 text-sm text-ember">{localBlockedReason}</p>
      )}
      {hint && (
        <p className="mb-2 text-sm text-ash">{hint}</p>
      )}

      {imagePreview && (
        <div className="relative mb-3 inline-block">
          <img
            src={imagePreview}
            alt="Attachment preview"
            className="max-h-24 rounded-lg border border-bone object-cover"
          />
          <button
            type="button"
            onClick={removeImage}
            className="absolute -right-2 -top-2 rounded-full bg-ink p-0.5 text-cream hover:bg-ash"
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
        <div className="flex items-center gap-2 rounded-full border border-bone bg-cream py-1.5 pl-3 pr-1.5 sm:gap-3 sm:py-2 sm:pl-4 sm:pr-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-ash transition-colors hover:text-ink active:scale-90"
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
          <input
            value={body}
            onChange={handleBodyChange}
            placeholder="Write a message"
            className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-ash"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button
            type="submit"
            disabled={isPending || (!body.trim() && !imageFile)}
            aria-label="Send message"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full bg-saffron text-cream transition-all hover:bg-saffron-dk active:scale-90",
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
