"use client";

import { useTransition, useState, useRef, useCallback } from "react";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { Avatar } from "@/components/primitives/Avatar";
import { getSupabaseBrowser } from "@/lib/supabase/client";
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

      const fd = new FormData();
      fd.set("body", body);
      fd.set("hashtags", hashtags.join(" "));

      if (images.length > 0) {
        images.forEach((p) => fd.append("images", p.file));
      } else if (videoFile) {
        fd.set("video", videoFile);
      }

      setServerError(null);
      startTransition(async () => {
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

  return (
    <div
      className={cn(
        "rounded-lg border border-bone bg-paper p-6",
        isDemo && "opacity-60"
      )}
    >
      {isDemo ? (
        <p className="text-caption mb-4 text-center">Sign up to post. Demo mode.</p>
      ) : null}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Author row */}
        <div className="flex items-start gap-3">
          <Avatar name="You" size="md" />

          {/* Textarea */}
          <div className="relative min-w-0 flex-1">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_BODY))}
              placeholder="What are you building, learning, or thinking?"
              rows={3}
              disabled={isDemo || isPending}
              className={cn(
                "w-full resize-none rounded-md border border-bone bg-cream px-4 py-3 text-body text-ink placeholder:text-ash",
                "focus:border-saffron focus:outline-none transition-colors",
                "disabled:cursor-not-allowed"
              )}
            />
            {/* Char counter */}
            <span
              className={cn(
                "absolute bottom-2 right-3 tabular-nums",
                "text-caption",
                body.length > BODY_WARN ? "text-ember" : "text-ash"
              )}
              style={{ fontSize: "0.75rem" }}
            >
              {charsLeft}
            </span>
          </div>
        </div>

        {/* Hashtag chips */}
        {hashtags.length > 0 ? (
          <div className="ml-11 flex flex-wrap gap-2">
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
          <div className="ml-11 flex flex-wrap gap-2">
            {images.map((p, i) => (
              <div key={p.objectUrl} className="relative size-20 shrink-0">
                <img
                  src={p.objectUrl}
                  alt=""
                  className="size-full rounded-md object-cover border border-bone"
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-ink text-cream shadow"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {/* Video preview */}
        {videoFile ? (
          <div className="ml-11 flex items-center gap-3 rounded-md border border-bone bg-cream px-3 py-2">
            <Video className="size-4 shrink-0 text-ash" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink">{videoFile.name}</span>
            <button type="button" onClick={removeVideo} className="shrink-0 text-ash hover:text-ember">
              <X className="size-4" />
            </button>
          </div>
        ) : null}

        {/* Video error */}
        {videoError ? (
          <p className="ml-11 text-sm text-ember">{videoError}</p>
        ) : null}

        {/* Server error */}
        {serverError ? (
          <p className="ml-11 text-sm text-ember">{serverError}</p>
        ) : null}

        {/* Action row */}
        <div className="ml-11 flex flex-wrap items-center gap-2">
          {/* Image trigger */}
          <button
            type="button"
            disabled={isDemo || isPending || videoFile !== null || images.length >= MAX_IMAGES}
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ash transition-colors hover:bg-bone hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            title="Add images"
          >
            <ImagePlus className="size-4" />
            <span>Photo</span>
          </button>

          {/* Video trigger */}
          <button
            type="button"
            disabled={isDemo || isPending || images.length > 0}
            onClick={() => videoInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-ash transition-colors hover:bg-bone hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            title="Add video"
          >
            <Video className="size-4" />
            <span>Video</span>
          </button>

          {/* Hashtag input */}
          <div className="flex items-center gap-1 rounded-md border border-bone bg-cream px-3 py-1.5">
            <Hash className="size-4 shrink-0 text-ash" />
            <input
              type="text"
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value.replace(/\s/, ""))}
              onKeyDown={handleHashKeyDown}
              placeholder="tag"
              disabled={isDemo || isPending}
              className="w-20 bg-transparent text-sm text-ink placeholder:text-ash focus:outline-none disabled:cursor-not-allowed"
            />
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Submit */}
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!canPost}
            className="group h-11"
          >
            {isPending ? "Posting..." : "Post"}
            <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
          </Button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleImageChange}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={handleVideoChange}
        />
      </form>
    </div>
  );
}
