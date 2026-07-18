"use client";

import { useTransition, useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { Avatar } from "@/components/primitives/Avatar";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  prepareImageForUpload,
  videoTooLarge,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
} from "@/lib/media/compress";
import { ImagePlus, Video, Hash, ArrowRight, X, Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

const MAX_BODY = 2000;
const BODY_WARN = 1900;
const MAX_IMAGES = 5;
const MAX_VIDEO_SECONDS = 60;

/** Payload handed up for the optimistic feed insert (FeedClient builds the card). */
export interface OptimisticPostInput {
  body: string;
  hashtags: string[];
  image_urls: string[];
  video_url: string | null;
}

interface PostComposerProps {
  // Server action that accepts a FormData. Returns { ok, postId?, shortId?, error? }.
  action: (formData: FormData) => Promise<{ ok: boolean; postId?: string; shortId?: string; error?: string }>;
  // The real signed-in user, so the composer avatar shows their photo/initials.
  me?: { name: string; avatar_url: string | null };
  // Trending tags to suggest in the hashtag autocomplete (real, from the page).
  suggestedTags?: string[];
  // Optimistic insert hooks (wired by FeedClient). Optional - composer works without.
  onOptimisticPost?: (input: OptimisticPostInput) => string;
  onResolvePost?: (tempId: string, result: { ok: boolean; postId?: string; shortId?: string }) => void;
}

interface ImagePreview {
  file: File;
  objectUrl: string;
}

type BrowserClient = NonNullable<ReturnType<typeof getSupabaseBrowser>>;

// Upload one file to the post-media bucket under the user's folder (RLS requires
// the first path segment to equal auth.uid()). Returns the public URL.
async function uploadToBucket(sb: BrowserClient, userId: string, file: File): Promise<string | null> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await sb.storage.from("post-media").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  const { data } = sb.storage.from("post-media").getPublicUrl(path);
  return data.publicUrl;
}

export function PostComposer({
  action,
  me,
  suggestedTags = [],
  onOptimisticPost,
  onResolvePost,
}: PostComposerProps) {
  const isDemo = getSupabaseBrowser() === null;

  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashInput, setHashInput] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the body textarea: reset to 'auto' then grow to scrollHeight,
  // capped at MAX_BODY_HEIGHT (after which it scrolls internally).
  const MAX_BODY_HEIGHT = 240;
  function autoGrowBody(el: HTMLTextAreaElement) {
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_BODY_HEIGHT)}px`;
  }

  // ---- Cleanup object URLs on reset ----
  function resetForm() {
    images.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setBody("");
    setFocused(false);
    setImages([]);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoDuration(null);
    setVideoError(null);
    setHashtags([]);
    setHashInput("");
    setTagMenuOpen(false);
    setServerError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
    if (bodyRef.current) bodyRef.current.style.height = "auto";
  }

  // ---- Shared image-add path (used by picker, drag-drop and paste) ----
  const addImageFiles = useCallback(
    (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (imageFiles.length === 0 || videoFile) return;
      setImages((prev) => {
        const remaining = MAX_IMAGES - prev.length;
        const accepted = imageFiles.slice(0, remaining).map((f) => ({
          file: f,
          objectUrl: URL.createObjectURL(f),
        }));
        return [...prev, ...accepted].slice(0, MAX_IMAGES);
      });
    },
    [videoFile]
  );

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    addImageFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  // ---- Video picker (with real thumbnail + duration) ----
  function handleVideoChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVideoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (videoTooLarge(file)) {
      setVideoError("Video must be under 100 MB.");
      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
      return;
    }

    const url = URL.createObjectURL(file);
    const vid = document.createElement("video");
    vid.preload = "metadata";
    vid.src = url;
    vid.onerror = () => {
      URL.revokeObjectURL(url);
      setVideoError("Couldn't read this video. The file may be corrupt or unsupported.");
      setVideoFile(null);
      if (videoInputRef.current) videoInputRef.current.value = "";
    };
    vid.onloadedmetadata = () => {
      if (vid.duration > MAX_VIDEO_SECONDS) {
        URL.revokeObjectURL(url);
        setVideoError(`Video must be under ${MAX_VIDEO_SECONDS} seconds.`);
        setVideoFile(null);
        if (videoInputRef.current) videoInputRef.current.value = "";
        return;
      }
      // Keep the object URL alive for the preview thumbnail.
      setVideoFile(file);
      setVideoUrl(url);
      setVideoDuration(vid.duration);
    };
  }

  function removeVideo() {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoDuration(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  // ---- Hashtag chip input + autocomplete ----
  const MAX_TAGS = 15;

  // Accepts one OR many tags at once: pasting "#Collab47 #BuildInPublic, day1"
  // becomes three separate chips. Splits on whitespace / commas / #, sanitises
  // each token, de-dupes against existing chips, and respects the MAX_TAGS cap.
  function commitTag(raw: string) {
    const tokens = raw
      .split(/[\s,#]+/)
      .map((t) => t.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase())
      .filter(Boolean);
    if (tokens.length > 0) {
      setHashtags((prev) => {
        const next = [...prev];
        for (const t of tokens) {
          if (next.length >= MAX_TAGS) break;
          if (!next.includes(t)) next.push(t);
        }
        return next;
      });
    }
    setHashInput("");
    setTagMenuOpen(false);
  }

  function handleHashKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === " " || e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitTag(hashInput);
    } else if (e.key === "Backspace" && hashInput === "" && hashtags.length > 0) {
      setHashtags((prev) => prev.slice(0, -1));
    }
  }

  // Paste a whole batch of tags at once (e.g. a line of "#a #b #c") and have
  // them fan out into individual chips instead of landing as one blob.
  function handleHashPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text");
    if (/[\s,#]/.test(text)) {
      e.preventDefault();
      commitTag(`${hashInput} ${text}`);
    }
  }

  function removeHashtag(tag: string) {
    setHashtags((prev) => prev.filter((t) => t !== tag));
  }

  const tagSuggestions = useMemo(() => {
    const q = hashInput.toLowerCase().replace(/[^a-z0-9_]/g, "");
    return suggestedTags
      .map((t) => t.toLowerCase())
      .filter((t) => !hashtags.includes(t) && (q === "" || t.includes(q)))
      .slice(0, 6);
  }, [suggestedTags, hashtags, hashInput]);

  // ---- Drag and drop ----
  function handleDrop(e: React.DragEvent<HTMLFormElement>) {
    e.preventDefault();
    setDragging(false);
    if (isDemo || isPending) return;
    addImageFiles(Array.from(e.dataTransfer.files ?? []));
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData.files ?? []);
    if (files.some((f) => f.type.startsWith("image/"))) {
      e.preventDefault();
      addImageFiles(files);
    }
  }

  // ---- Submit ----
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (isDemo || isPending) return;

      const sb = getSupabaseBrowser();
      if (!sb) {
        setServerError("Posting is not available right now.");
        return;
      }

      setServerError(null);
      startTransition(async () => {
        const { data: { user } } = await sb.auth.getUser();
        if (!user) {
          setServerError("Please sign in again.");
          return;
        }

        // 1. Upload media CLIENT-SIDE straight to Supabase Storage.
        const image_urls: string[] = [];
        let video_url: string | null = null;
        try {
          if (images.length > 0) {
            // Compress + upload all images CONCURRENTLY (Promise.all preserves
            // order), instead of one-at-a-time - a big speed win on multi-image
            // posts so the composer doesn't feel frozen.
            const uploaded = await Promise.all(
              images.map(async (p) => {
                const toUpload = await prepareImageForUpload(p.file);
                return uploadToBucket(sb, user.id, toUpload);
              })
            );
            for (const url of uploaded) if (url) image_urls.push(url);
          } else if (videoFile) {
            video_url = await uploadToBucket(sb, user.id, videoFile);
          }
        } catch (err) {
          setServerError(
            err instanceof Error ? `Upload failed: ${err.message}` : "Media upload failed."
          );
          return;
        }

        // 2. Merge inline #tags typed in the body with the chip tags.
        const inlineTags = (body.match(/#([a-zA-Z0-9_]+)/g) ?? []).map((t) => t.slice(1).toLowerCase());
        const allTags = [...new Set([...hashtags, ...inlineTags])];

        // 3. Optimistic insert at the top of the feed (instant), then persist.
        const tempId = onOptimisticPost?.({ body, hashtags: allTags, image_urls, video_url });

        const fd = new FormData();
        fd.set("body", body);
        fd.set("hashtags", allTags.join(" "));
        fd.set("image_urls", JSON.stringify(image_urls));
        if (video_url) fd.set("video_url", video_url);

        const result = await action(fd);
        if (tempId && onResolvePost) onResolvePost(tempId, result);

        if (result.ok) {
          resetForm();
        } else {
          setServerError(result.error ?? "Something went wrong. Please try again.");
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body, hashtags, images, videoFile, isDemo, isPending, action, onOptimisticPost, onResolvePost]
  );

  const charsLeft = MAX_BODY - body.length;
  const canPost =
    (body.trim().length > 0 || images.length > 0 || videoFile !== null) && !isPending && !isDemo;
  const overWarn = body.length > BODY_WARN;
  const expanded = focused || body.length > 0 || images.length > 0 || videoFile !== null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-bone bg-paper shadow-sm shadow-ink/[0.03] transition-colors",
        "focus-within:border-saffron/50 focus-within:shadow-md focus-within:shadow-saffron/5",
        dragging && "border-saffron ring-2 ring-saffron/20",
        isDemo && "opacity-60"
      )}
    >
      {isDemo ? (
        <p className="px-5 pt-4 text-center text-xs text-ash">Sign up to post. Demo mode.</p>
      ) : null}

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDemo && !isPending && !videoFile) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={handleDrop}
        className="relative flex flex-col gap-4 p-4 sm:p-5"
      >
        {dragging ? (
          <div className="pointer-events-none absolute inset-1.5 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-saffron bg-paper/85 text-sm font-medium text-saffron">
            Drop images to add
          </div>
        ) : null}

        {/* Author row + textarea */}
        <div className="flex items-start gap-3">
          <Avatar name={me?.name ?? "You"} src={me?.avatar_url ?? undefined} size="md" className="shrink-0 ring-2 ring-bone" />

          <div className="relative min-w-0 flex-1">
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => {
                setBody(e.target.value.slice(0, MAX_BODY));
                autoGrowBody(e.currentTarget);
              }}
              onFocus={() => setFocused(true)}
              onPaste={handlePaste}
              placeholder="What are you building, learning, or shipping?"
              rows={expanded ? 4 : 2}
              disabled={isDemo || isPending}
              className={cn(
                "w-full resize-none overflow-y-auto rounded-xl border border-transparent bg-cream px-4 py-3 text-body text-ink placeholder:text-ash",
                "transition-all focus:border-saffron/40 focus:bg-paper focus:outline-none focus:ring-2 focus:ring-saffron/15",
                "disabled:cursor-not-allowed"
              )}
            />
          </div>
        </div>

        {/* Media tray: image gallery preview (aspect-aware) */}
        {images.length > 0 ? (
          <div className="sm:ml-[3.25rem]">
            <div className="flex items-center justify-between pb-1.5">
              <span className="text-xs font-medium text-ash">
                {images.length}/{MAX_IMAGES} photo{images.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className={cn(
                "grid gap-1.5",
                images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
              )}
            >
              {images.map((p, i) => (
                <div
                  key={p.objectUrl}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border border-bone bg-ink/[0.04]",
                    images.length === 1 ? "max-h-72" : "aspect-square"
                  )}
                >
                  <img
                    src={p.objectUrl}
                    alt=""
                    className={cn(
                      "w-full object-cover",
                      images.length === 1 ? "max-h-72 object-contain" : "size-full"
                    )}
                  />
                  {isPending ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/45">
                      <Loader2 className="size-6 animate-spin text-cream" />
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label="Remove image"
                      className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/80 text-cream shadow transition-transform hover:scale-110 active:scale-95"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Media tray: real video thumbnail with duration + play glyph */}
        {videoFile && videoUrl ? (
          <div className="sm:ml-[3.25rem]">
            <div className="relative overflow-hidden rounded-xl border border-bone bg-ink">
              <video
                src={videoUrl}
                preload="metadata"
                muted
                playsInline
                className="max-h-72 w-full bg-ink object-contain"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-paper/85 shadow">
                  <Play className="ml-0.5 size-5 fill-ink text-ink" />
                </span>
              </span>
              {videoDuration != null ? (
                <span className="absolute bottom-2 right-2 rounded bg-ink/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-cream">
                  {formatDuration(videoDuration)}
                </span>
              ) : null}
              {isPending ? (
                <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-ink/55">
                  <Loader2 className="size-7 animate-spin text-cream" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={removeVideo}
                  aria-label="Remove video"
                  className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-ink/80 text-cream shadow transition-transform hover:scale-110 active:scale-95"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : null}

        {videoError ? <p className="text-sm text-ember sm:ml-[3.25rem]">{videoError}</p> : null}
        {serverError ? <p className="text-sm text-ember sm:ml-[3.25rem]">{serverError}</p> : null}

        {/* Hashtag chips + full-width field on its own row */}
        {expanded ? (
          <div className="sm:ml-[3.25rem]">
            {hashtags.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {hashtags.map((t) => (
                  <button key={t} type="button" onClick={() => removeHashtag(t)} className="group">
                    <Tag variant="saffron">
                      #{t}
                      <X className="ml-1 size-3 opacity-60 group-hover:opacity-100" />
                    </Tag>
                  </button>
                ))}
              </div>
            ) : null}
            <div className="relative">
              <div className="flex min-h-11 items-center gap-2 rounded-xl border border-bone bg-cream px-3 transition-colors focus-within:border-saffron/50 focus-within:bg-paper">
                <Hash className="size-4 shrink-0 text-ash" />
                <input
                  type="text"
                  value={hashInput}
                  onChange={(e) => {
                    setHashInput(e.target.value.replace(/\s/, ""));
                    setTagMenuOpen(true);
                  }}
                  onFocus={() => setTagMenuOpen(true)}
                  onBlur={() => setTimeout(() => setTagMenuOpen(false), 120)}
                  onKeyDown={handleHashKeyDown}
                  onPaste={handleHashPaste}
                  placeholder="Add tags - paste a batch or type, space to separate"
                  disabled={isDemo || isPending}
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink placeholder:text-ash focus:outline-none disabled:cursor-not-allowed"
                />
              </div>
              {tagMenuOpen && tagSuggestions.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-bone bg-paper py-1 shadow-xl shadow-ink/5">
                  <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ash">
                    Trending now
                  </p>
                  {tagSuggestions.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commitTag(t);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-cream"
                    >
                      <Hash className="size-3.5 text-saffron" />
                      <span className="truncate">{t}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Action row */}
        <div className="flex flex-wrap items-center gap-1.5 sm:ml-[3.25rem]">
          <ToolButton
            disabled={isDemo || isPending || videoFile !== null || images.length >= MAX_IMAGES}
            onClick={() => imageInputRef.current?.click()}
            icon={<ImagePlus className="size-4 shrink-0" />}
            label="Photo"
            title={videoFile ? "Remove the video to add photos" : "Add photos"}
          />
          <ToolButton
            disabled={isDemo || isPending || images.length > 0}
            onClick={() => videoInputRef.current?.click()}
            icon={<Video className="size-4 shrink-0" />}
            label="Video"
            title={images.length > 0 ? "Remove photos to add a video" : "Add a video"}
          />

          <div className="ml-auto flex items-center gap-3">
            {body.length > 0 ? (
              <span
                className={cn(
                  "tabular-nums text-xs font-medium",
                  overWarn ? "text-ember" : charsLeft < 200 ? "text-gold" : "text-ash"
                )}
              >
                {charsLeft}
              </span>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!canPost}
              className="group h-11 shrink-0 rounded-xl transition-transform active:scale-95"
            >
              {isPending ? "Posting..." : "Post"}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:translate-x-0" />
            </Button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={handleImageChange}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          className="hidden"
          onChange={handleVideoChange}
        />
      </form>
    </div>
  );
}

function ToolButton({
  disabled,
  onClick,
  icon,
  label,
  title,
}: {
  disabled?: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ash transition-colors hover:bg-cream hover:text-saffron active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
