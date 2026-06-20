"use client";

import { useTransition, useState, useRef, useCallback } from "react";
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
import { ImagePlus, Video, Hash, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/cn";

const MAX_BODY = 2000;
const BODY_WARN = 1900;
const MAX_IMAGES = 5;
const MAX_VIDEO_SECONDS = 60;

interface PostComposerProps {
  // Server action that accepts a FormData. Must return { ok: boolean; error?: string }.
  action: (formData: FormData) => Promise<{ ok: boolean; error?: string }>;
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

export function PostComposer({ action }: PostComposerProps) {
  const isDemo = getSupabaseBrowser() === null;

  const [isPending, startTransition] = useTransition();
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashInput, setHashInput] = useState("");
  const [serverError, setServerError] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // ---- Cleanup object URLs on reset ----
  function resetForm() {
    images.forEach((p) => URL.revokeObjectURL(p.objectUrl));
    if (videoFile) URL.revokeObjectURL(URL.createObjectURL(videoFile));
    setBody("");
    setImages([]);
    setVideoFile(null);
    setVideoError(null);
    setHashtags([]);
    setHashInput("");
    setServerError(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  // ---- Image picker ----
  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    const remaining = MAX_IMAGES - images.length;
    const accepted = files.slice(0, remaining);
    const previews: ImagePreview[] = accepted.map((f) => ({
      file: f,
      objectUrl: URL.createObjectURL(f),
    }));
    setImages((prev) => [...prev, ...previews].slice(0, MAX_IMAGES));
    // Reset input so same file can be picked again after removal
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].objectUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  // ---- Video picker ----
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
    vid.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (vid.duration > MAX_VIDEO_SECONDS) {
        setVideoError(`Video must be under ${MAX_VIDEO_SECONDS} seconds.`);
        setVideoFile(null);
        if (videoInputRef.current) videoInputRef.current.value = "";
        return;
      }
      setVideoFile(file);
    };
  }

  function removeVideo() {
    setVideoFile(null);
    setVideoError(null);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  // ---- Hashtag chip input ----
  function handleHashKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const tag = hashInput.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
      if (tag && !hashtags.includes(tag)) {
        setHashtags((prev) => [...prev, tag]);
      }
      setHashInput("");
    } else if (e.key === "Backspace" && hashInput === "" && hashtags.length > 0) {
      setHashtags((prev) => prev.slice(0, -1));
    }
  }

  function removeHashtag(tag: string) {
    setHashtags((prev) => prev.filter((t) => t !== tag));
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
        // 1. Resolve the user (storage paths must live under their id for RLS).
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setServerError("Please sign in again.");
          return;
        }

        // 2. Upload media CLIENT-SIDE straight to Supabase Storage.
        let image_urls: string[] = [];
        let video_url: string | null = null;
        try {
          if (images.length > 0) {
            for (const p of images) {
              // Routes HEIC/HEIF -> JPEG and compresses every image before upload.
              const toUpload = await prepareImageForUpload(p.file);
              const url = await uploadToBucket(sb, user.id, toUpload);
              if (url) image_urls.push(url);
            }
          } else if (videoFile) {
            video_url = await uploadToBucket(sb, user.id, videoFile);
          }
        } catch (err) {
          setServerError(
            err instanceof Error ? `Upload failed: ${err.message}` : "Media upload failed."
          );
          return;
        }

        // 3. Send only text + URLs to the action (tiny payload, no size limit).
        const fd = new FormData();
        fd.set("body", body);
        fd.set("hashtags", hashtags.join(" "));
        fd.set("image_urls", JSON.stringify(image_urls));
        if (video_url) fd.set("video_url", video_url);

        const result = await action(fd);
        if (result.ok) {
          resetForm();
        } else {
          setServerError(result.error ?? "Something went wrong. Please try again.");
        }
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [body, hashtags, images, videoFile, isDemo, isPending, action]
  );

  const charsLeft = MAX_BODY - body.length;
  const canPost = body.trim().length > 0 && !isPending && !isDemo;
  const overWarn = body.length > BODY_WARN;

  return (
    <div
      className={cn(
        "rounded-lg border border-bone bg-paper p-4 transition-colors focus-within:border-saffron/40 sm:p-6",
        isDemo && "opacity-60"
      )}
    >
      {isDemo ? (
        <p className="text-caption mb-4 text-center">Sign up to post. Demo mode.</p>
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Author row */}
        <div className="flex items-start gap-3">
          <Avatar name="You" size="md" className="shrink-0" />

          {/* Textarea */}
          <div className="relative min-w-0 flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              placeholder="What are you building, learning, or thinking?"
              rows={3}
              disabled={isDemo || isPending}
              className={cn(
                "w-full resize-none rounded-md border border-bone bg-cream px-4 py-3 pb-7 text-body text-ink placeholder:text-ash",
                "transition-colors focus:border-saffron focus:bg-paper focus:outline-none focus:ring-2 focus:ring-saffron/15",
                "disabled:cursor-not-allowed"
              )}
            />
            {/* Char counter — only surfaces once the user starts typing. */}
            {body.length > 0 ? (
              <span
                className={cn(
                  "pointer-events-none absolute bottom-2.5 right-3 tabular-nums",
                  "text-[0.72rem] font-medium transition-colors",
                  overWarn ? "text-ember" : charsLeft < 200 ? "text-gold" : "text-ash"
                )}
              >
                {charsLeft}
              </span>
            ) : null}
          </div>
        </div>

        {/* Hashtag chips */}
        {hashtags.length > 0 ? (
          <div className="flex flex-wrap gap-2 sm:ml-11">
            {hashtags.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => removeHashtag(t)}
                className="group flex items-center gap-1"
              >
                <Tag variant="saffron">
                  #{t}
                  <X className="ml-1 size-3 opacity-60 group-hover:opacity-100" />
                </Tag>
              </button>
            ))}
          </div>
        ) : null}

        {/* Image thumbnails */}
        {images.length > 0 ? (
          <div className="flex flex-wrap gap-2 sm:ml-11">
            {images.map((p, i) => (
              <div key={p.objectUrl} className="group relative size-20 shrink-0">
                <img
                  src={p.objectUrl}
                  alt=""
                  className="size-full rounded-md object-cover border border-bone"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  aria-label="Remove image"
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-cream shadow transition-transform hover:scale-110 active:scale-95"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Video preview */}
        {videoFile ? (
          <div className="flex items-center gap-3 rounded-md border border-bone bg-cream px-3 py-2 sm:ml-11">
            <Video className="size-4 shrink-0 text-ash" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{videoFile.name}</span>
            <button type="button" onClick={removeVideo} aria-label="Remove video" className="shrink-0 text-ash transition-colors hover:text-ember active:scale-95">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Video error */}
        {videoError ? (
          <p className="text-sm text-ember sm:ml-11">{videoError}</p>
        ) : null}

        {/* Server error */}
        {serverError ? (
          <p className="text-sm text-ember sm:ml-11">{serverError}</p>
        ) : null}

        {/* Action row — wraps cleanly at 360px; media + tag controls sit on one
            row, the Post button anchors to the right (drops below on tiny widths). */}
        <div className="flex flex-wrap items-center gap-2 sm:ml-11">
          {/* Image trigger */}
          <button
            type="button"
            disabled={isDemo || isPending || videoFile !== null || images.length >= MAX_IMAGES}
            onClick={() => imageInputRef.current?.click()}
            className="flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ash transition-colors hover:bg-bone hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
            title="Add images"
          >
            <ImagePlus className="size-4 shrink-0" />
            <span>Photo</span>
          </button>

          {/* Video trigger */}
          <button
            type="button"
            disabled={isDemo || isPending || images.length > 0}
            onClick={() => videoInputRef.current?.click()}
            className="flex min-h-10 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-ash transition-colors hover:bg-bone hover:text-ink active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 sm:px-3"
            title="Add video"
          >
            <Video className="size-4 shrink-0" />
            <span>Video</span>
          </button>

          {/* Hashtag input */}
          <div className="flex min-h-10 items-center gap-1 rounded-md border border-bone bg-cream px-3 py-1.5 transition-colors focus-within:border-saffron">
            <Hash className="size-4 shrink-0 text-ash" />
            <input
              type="text"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value.replace(/\s/, ""))}
              onKeyDown={handleHashKeyDown}
              placeholder="tag"
              disabled={isDemo || isPending}
              className="w-16 bg-transparent text-sm text-ink placeholder:text-ash focus:outline-none disabled:cursor-not-allowed sm:w-20"
            />
          </div>

          {/* Spacer pushes Post to the right when the row has room */}
          <div className="ml-auto" />

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!canPost}
            className="group h-11 shrink-0 transition-transform active:scale-95"
          >
            {isPending ? "Posting…" : "Post"}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:translate-x-0" />
          </Button>
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
