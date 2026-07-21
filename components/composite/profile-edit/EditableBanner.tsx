"use client";

import { useCallback, useRef, useState } from "react";
import { Check, Move, Pencil, RotateCcw, Upload, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/primitives/Button";
import { ProfileBanner } from "@/components/composite/ProfileBanner";
import {
  BANNER_PRESETS,
  BANNER_FAMILIES,
  DEFAULT_BANNER,
  type BannerFamily,
} from "@/lib/data/banners";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import { cn } from "@/lib/cn";
import { useEditableProfile } from "./EditableProfileProvider";
import { uploadImage } from "./uploadImage";
import { Modal } from "./Modal";

const MAX_COVER_BYTES = 1_048_576; // 1 MB hard cap (matches ProfileEditForm)

type BannerMode = "preset" | "upload";

export function EditableBanner({
  className,
  priority,
}: {
  className?: string;
  priority?: boolean;
}) {
  const { values, save } = useEditableProfile();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="group relative">
        <ProfileBanner
          coverUrl={values.cover_url || null}
          bannerPreset={values.banner_preset || null}
          focalX={values.cover_focal_x}
          focalY={values.cover_focal_y}
          priority={priority}
          className={className}
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Edit banner"
          className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-1.5 rounded-full border border-cream/30 bg-ink/45 px-3.5 text-sm font-medium text-cream backdrop-blur transition-colors hover:bg-ink/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream [@media(hover:hover)]:opacity-80 [@media(hover:hover)]:group-hover:opacity-100"
        >
          <Pencil className="size-4" strokeWidth={1.75} /> Edit banner
        </button>
      </div>

      {open ? <BannerEditor onClose={() => setOpen(false)} values={values} save={save} /> : null}
    </>
  );
}

function BannerEditor({
  onClose,
  values,
  save,
}: {
  onClose: () => void;
  values: ReturnType<typeof useEditableProfile>["values"];
  save: ReturnType<typeof useEditableProfile>["save"];
}) {
  const [mode, setMode] = useState<BannerMode>(values.cover_url ? "upload" : "preset");
  const [presetId, setPresetId] = useState<string>(values.banner_preset || DEFAULT_BANNER);
  const [coverPreview, setCoverPreview] = useState<string | null>(values.cover_url || null);
  const [focalX, setFocalX] = useState<number>(values.cover_focal_x ?? 50);
  const [focalY, setFocalY] = useState<number>(values.cover_focal_y ?? 50);
  const [family, setFamily] = useState<BannerFamily>("gradient");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Drag-to-reposition: pointer -> 0..100 focal point (mirrors ProfileEditForm).
  const repositionFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, Math.round(((clientX - r.left) / r.width) * 100)));
    const y = Math.min(100, Math.max(0, Math.round(((clientY - r.top) / r.height) * 100)));
    setFocalX(x);
    setFocalY(y);
  }, []);

  function onStagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    repositionFromPointer(e.clientX, e.clientY);
  }
  function onStagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    repositionFromPointer(e.clientX, e.clientY);
  }

  function onPickCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCoverPreview(URL.createObjectURL(file));
    setMode("upload");
    setFocalX(50);
    setFocalY(50);
  }

  async function handleSave() {
    setError(null);
    setPending(true);
    try {
      if (mode === "preset") {
        setStatus("Saving...");
        const res = await save({
          banner_preset: presetId,
          cover_url: "",
          cover_focal_x: 50,
          cover_focal_y: 50,
        });
        if (!res.ok) {
          setError(res.error);
          return;
        }
        onClose();
        return;
      }

      // Upload mode.
      const file = fileRef.current?.files?.[0] ?? null;
      if (!file && !coverPreview) {
        setError("Upload an image or pick a preset.");
        return;
      }

      let coverUrl = values.cover_url;
      if (file) {
        const sb = getSupabaseBrowser();
        if (!sb) {
          setError("Photo storage is not available right now.");
          return;
        }
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setError("Please sign in again.");
          return;
        }
        setStatus("Preparing image...");
        const toUpload = await prepareImageForUpload(file);
        if (toUpload.size > MAX_COVER_BYTES) {
          setError("Cover image is too large after compression. Please use an image under 1 MB.");
          return;
        }
        setStatus("Uploading banner...");
        coverUrl = await uploadImage(sb, user.id, toUpload, "covers");
      }

      setStatus("Saving...");
      const res = await save({
        banner_preset: "",
        cover_url: coverUrl,
        cover_focal_x: focalX,
        cover_focal_y: focalY,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? `Upload failed: ${err.message}` : "Something went wrong.");
    } finally {
      setPending(false);
      setStatus(null);
    }
  }

  return (
    <Modal
      title="Banner"
      size="lg"
      onClose={() => !pending && onClose()}
      footer={
        <>
          <button
            type="button"
            onClick={() => !pending && onClose()}
            className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
          >
            Cancel
          </button>
          <Button type="button" size="md" onClick={handleSave} disabled={pending} className="gap-2">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            {pending ? status ?? "Saving..." : mode === "upload" ? "Save position" : "Save banner"}
          </Button>
        </>
      }
    >
      {/* Live preview - exactly what the profile will show. */}
      <ProfileBanner
        coverUrl={mode === "upload" ? coverPreview : null}
        bannerPreset={mode === "preset" ? presetId : null}
        focalX={focalX}
        focalY={focalY}
        className="h-32 rounded-xl sm:h-40"
        priority
      />

      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Banner source"
        className="mt-4 inline-flex rounded-lg border border-bone bg-cream p-1"
      >
        {(
          [
            { id: "preset" as BannerMode, label: "Presets" },
            { id: "upload" as BannerMode, label: "Upload" },
          ]
        ).map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "min-h-9 rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
              mode === m.id ? "bg-paper text-ink shadow-sm" : "text-ash hover:text-ink",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === "preset" ? (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            {BANNER_FAMILIES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFamily(f.id)}
                aria-pressed={family === f.id}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
                  family === f.id
                    ? "border-transparent bg-ink text-cream"
                    : "border-bone text-ash hover:text-ink",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {BANNER_PRESETS.filter((b) => b.family === family).map((b) => {
              const selected = mode === "preset" && presetId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => {
                    setPresetId(b.id);
                    setMode("preset");
                  }}
                  aria-pressed={selected}
                  aria-label={`Banner: ${b.label}`}
                  className={cn(
                    "group/preset relative block overflow-hidden rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron",
                    selected ? "ring-2 ring-saffron" : "ring-1 ring-bone",
                  )}
                >
                  <ProfileBanner bannerPreset={b.id} className="h-16 sm:h-20" />
                  {selected ? (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-paper shadow">
                      <Check className="size-3 text-saffron" strokeWidth={3} />
                    </span>
                  ) : null}
                  <span className="absolute bottom-1 left-1.5 rounded bg-ink/55 px-1.5 py-0.5 text-[10px] font-medium text-cream backdrop-blur-sm">
                    {b.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          {coverPreview ? (
            <>
              <div
                ref={stageRef}
                onPointerDown={onStagePointerDown}
                onPointerMove={onStagePointerMove}
                className="relative h-40 w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-bone bg-cream active:cursor-grabbing sm:h-52"
                role="slider"
                aria-label="Drag to reposition your banner"
                aria-valuetext={`Focal point ${focalX}% from left, ${focalY}% from top`}
                tabIndex={0}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverPreview}
                  alt="Banner preview"
                  className="pointer-events-none absolute inset-0 size-full object-cover"
                  style={{ objectPosition: `${focalX}% ${focalY}%` }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <span className="flex items-center gap-1.5 rounded-full border border-cream/30 bg-ink/45 px-3 py-1 text-xs font-medium text-cream backdrop-blur">
                    <Move className="size-3.5" /> Drag to reposition
                  </span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload className="size-3.5" /> Replace image
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setFocalX(50);
                    setFocalY(50);
                  }}
                  className="inline-flex min-h-9 items-center gap-1.5 text-xs text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                >
                  <RotateCcw className="size-3.5" /> Reset to center
                </button>
              </div>
              <p className="mt-2 text-xs text-ash">
                Images are compressed to under 1 MB. Drag the image to choose what shows.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bone bg-cream text-ash transition-colors hover:border-saffron hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron sm:h-52"
            >
              <Upload className="size-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">Upload a cover image</span>
              <span className="text-xs">Up to 1 MB. We compress it for you.</span>
            </button>
          )}
        </div>
      )}

      {error ? (
        <p className="mt-4 flex items-start gap-1.5 text-sm text-ember" role="alert" aria-live="assertive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </p>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={onPickCover}
      />
    </Modal>
  );
}
