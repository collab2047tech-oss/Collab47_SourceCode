"use client";

import { useRef, useState } from "react";
import { Camera, Trash2, Upload, Loader2, AlertCircle } from "lucide-react";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import { useEditableProfile } from "./EditableProfileProvider";
import { uploadImage } from "./uploadImage";
import { Modal } from "./Modal";

type Phase = "idle" | "compressing" | "uploading" | "saving" | "error";

const PHASE_LABEL: Record<Exclude<Phase, "idle" | "error">, string> = {
  compressing: "Preparing image...",
  uploading: "Uploading photo...",
  saving: "Saving...",
};

export function EditableAvatar() {
  const { values, save } = useEditableProfile();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Keep the last picked file so "Retry" can re-run without re-picking.
  const lastFileRef = useRef<File | null>(null);

  const busy = phase === "compressing" || phase === "uploading" || phase === "saving";

  function openEditor() {
    setError(null);
    setPhase("idle");
    setOpen(true);
  }

  async function runUpload(file: File) {
    lastFileRef.current = file;
    setError(null);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setPhase("error");
      setError("Photo storage is not available right now.");
      return;
    }
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) {
      setPhase("error");
      setError("Please sign in again.");
      return;
    }
    try {
      setPhase("compressing");
      const toUpload = await prepareImageForUpload(file);
      setPhase("uploading");
      const url = await uploadImage(sb, user.id, toUpload, "avatars");
      setPhase("saving");
      const res = await save({ avatar_url: url });
      if (!res.ok) {
        setPhase("error");
        setError(res.error);
        return;
      }
      setPhase("idle");
      setOpen(false);
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? `Upload failed: ${err.message}` : "Upload failed.");
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (file) void runUpload(file);
  }

  async function removePhoto() {
    setError(null);
    setPhase("saving");
    const res = await save({ avatar_url: "" });
    if (!res.ok) {
      setPhase("error");
      setError(res.error);
      return;
    }
    setPhase("idle");
    setOpen(false);
  }

  return (
    <>
      {/* Avatar with an always-tappable camera badge (44px) + desktop hover cue. */}
      <div className="group relative w-fit">
        <Avatar
          name={values.name}
          src={values.avatar_url || undefined}
          size="2xl"
          className="ring-4 ring-paper shadow-[0_0_0_1px_var(--color-bone)]"
        />
        {/* Desktop-only hover scrim - a pointer affordance only. It is aria-hidden
            and unfocusable so the badge below stays the single canonical control
            for keyboard + screen-reader users (no double announcement). */}
        <button
          type="button"
          aria-hidden
          tabIndex={-1}
          onClick={openEditor}
          className="absolute inset-0 hidden cursor-pointer items-center justify-center rounded-full bg-ink/45 text-cream opacity-0 transition-opacity duration-150 group-hover:opacity-100 [@media(hover:hover)]:flex"
        >
          <Camera className="size-6" strokeWidth={1.75} />
        </button>
        {/* Always-visible 44px badge (the accessible, tappable control). */}
        <button
          type="button"
          onClick={openEditor}
          aria-label="Edit photo"
          className="absolute -bottom-0.5 -right-0.5 flex size-11 items-center justify-center rounded-full border-2 border-paper bg-saffron text-cream shadow-md transition-colors hover:bg-saffron-dk focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
        >
          <Camera className="size-4" strokeWidth={2} />
        </button>
      </div>

      {open ? (
        <Modal title="Profile photo" onClose={() => !busy && setOpen(false)}>
          <div className="flex flex-col items-center gap-6">
            <Avatar
              name={values.name}
              src={values.avatar_url || undefined}
              size="2xl"
              className="ring-4 ring-cream shadow-[0_0_0_1px_var(--color-bone)]"
            />

            {busy ? (
              <div className="w-full max-w-xs" aria-live="polite">
                <div className="flex items-center justify-center gap-2 text-sm text-ink">
                  <Loader2 className="size-4 animate-spin text-saffron" />
                  {PHASE_LABEL[phase as Exclude<Phase, "idle" | "error">]}
                </div>
                {/* Honest indeterminate bar - the Storage SDK gives no byte %. */}
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bone">
                  <div className="h-full w-2/5 animate-pulse rounded-full bg-saffron" />
                </div>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-3">
                <Button
                  type="button"
                  size="md"
                  onClick={() => fileRef.current?.click()}
                  className="w-full max-w-xs gap-2"
                >
                  <Upload className="size-4" strokeWidth={1.75} />
                  {values.avatar_url ? "Upload new photo" : "Upload a photo"}
                </Button>
                {values.avatar_url ? (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-3 text-sm text-ash transition-colors hover:text-ember focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember"
                  >
                    <Trash2 className="size-4" strokeWidth={1.75} /> Remove photo
                  </button>
                ) : null}
                <p className="max-w-xs text-center text-xs text-ash">
                  A square headshot looks sharpest. Images are compressed for you.
                </p>
              </div>
            )}

            {phase === "error" && error ? (
              <div className="w-full max-w-xs" role="alert" aria-live="assertive">
                <p className="flex items-start gap-1.5 text-sm text-ember">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
                  {error}
                </p>
                {lastFileRef.current ? (
                  <button
                    type="button"
                    onClick={() => lastFileRef.current && runUpload(lastFileRef.current)}
                    className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-saffron-dk transition-colors hover:text-saffron focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                  >
                    Try again
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className="hidden"
            onChange={onPick}
          />
        </Modal>
      ) : null}
    </>
  );
}
