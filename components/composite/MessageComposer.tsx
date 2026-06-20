"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { sendMessageAction } from "@/app/(app)/messages/actions";
import { compressImage } from "@/lib/media/compress";
import { Paperclip, Send, X } from "lucide-react";
import { cn } from "@/lib/cn";

interface MessageComposerProps {
  conversationId: string;
  canCompose?: boolean;
  blockedReason?: string;
  /** Reason shown when canCompose is false (e.g. you blocked / were blocked). */
  cannotComposeReason?: string;
}

const TYPING_DEBOUNCE_MS = 800;

export function MessageComposer({
  conversationId,
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

  function broadcastTyping() {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.channel(`messages:conversation_id=eq.${conversationId}`).send({
      type: "broadcast",
      event: "typing",
      payload: { conversationId },
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
          const toUpload = await compressImage(imageFile);
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
      <footer className="border-t border-bone bg-paper px-6 py-4">
        <p className="text-center text-sm text-ash">
          {cannotComposeReason ?? "You cannot message this person."}
        </p>
      </footer>
    );
  }

  if (localBlockedReason && !body && !imageFile) {
    return (
      <footer className="border-t border-bone bg-paper px-6 py-4">
        <p className="text-center text-sm text-ember">{localBlockedReason}</p>
      </footer>
    );
  }

  return (
    <footer className="border-t border-bone bg-paper px-6 py-4">
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

      <form onSubmit={handleSubmit}>
        <div className="flex items-center gap-3 rounded-full border border-bone bg-cream px-4 py-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-ash transition-colors hover:text-ink"
            title="Attach image"
          >
            <Paperclip className="size-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
          <input
            value={body}
            onChange={handleBodyChange}
            placeholder="Write a message"
            className="w-full bg-transparent text-sm outline-none placeholder:text-ash"
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
            className={cn(
              "rounded-full bg-saffron p-2 text-cream transition-colors hover:bg-saffron-dk",
              "disabled:cursor-not-allowed disabled:opacity-40"
            )}
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </footer>
  );
}
