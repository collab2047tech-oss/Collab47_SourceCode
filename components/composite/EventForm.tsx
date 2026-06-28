"use client";

import { useTransition, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import { ImagePlus, X } from "lucide-react";
import { createEventAction } from "@/app/(app)/events/new/actions";

const KINDS: { value: string; label: string }[] = [
  { value: "hackathon", label: "Hackathon" },
  { value: "competition", label: "Competition" },
  { value: "workshop", label: "Workshop" },
  { value: "conference", label: "Conference" },
  { value: "fest", label: "Fest" },
  { value: "talk", label: "Talk" },
  { value: "other", label: "Other" },
];

const MODES: { value: string; label: string }[] = [
  { value: "online", label: "Online" },
  { value: "in_person", label: "In person" },
  { value: "hybrid", label: "Hybrid" },
];

const selectClass =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none";
const dateClass =
  "h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none";
const labelClass = "text-caption text-ink";

export function EventForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [descLen, setDescLen] = useState(0);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  function onPickImage() {
    const file = imageInputRef.current?.files?.[0];
    if (!file) {
      setImagePreview(null);
      return;
    }
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    if (imageInputRef.current) imageInputRef.current.value = "";
    setImagePreview(null);
  }

  /** Upload to the owner-scoped, public-read post-media bucket; returns a URL. */
  async function uploadImage(
    sb: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
    userId: string,
    file: File
  ): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/events/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from("post-media").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) throw upErr;
    return sb.storage.from("post-media").getPublicUrl(path).data.publicUrl;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const data = new FormData(form);
    // The file input is uploaded client-side; never send the File through the action.
    data.delete("image");

    const imageFile = imageInputRef.current?.files?.[0] ?? null;
    // An explicit image URL is the fallback when no file is chosen.
    const imageUrlField = (data.get("image_url") as string | null)?.trim() ?? "";

    startTransition(async () => {
      if (imageFile) {
        const sb = getSupabaseBrowser();
        if (!sb) {
          setError("Image upload is unavailable right now. Try an image URL instead.");
          return;
        }
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setError("Please sign in again.");
          return;
        }
        try {
          const toUpload = await prepareImageForUpload(imageFile);
          data.set("image_url", await uploadImage(sb, user.id, toUpload));
        } catch (err) {
          setError(
            err instanceof Error ? `Image upload failed: ${err.message}` : "Image upload failed."
          );
          return;
        }
      } else if (imageUrlField) {
        data.set("image_url", imageUrlField);
      }

      const result = await createEventAction(data);
      if (result.ok && result.id) {
        router.push(`/events/${result.id}`);
        return;
      }
      setError(result.error ?? "Failed to create event.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10 space-y-6">
      <Input
        label="Event title"
        name="title"
        required
        placeholder="e.g. Collab47 National Hackathon 2026"
        maxLength={160}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="kind" className={labelClass}>
            Type
          </label>
          <select id="kind" name="kind" defaultValue="hackathon" className={selectClass}>
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Organizer"
          name="organizer"
          placeholder="e.g. Acme Labs / IIT Delhi"
          maxLength={160}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label htmlFor="description" className={labelClass}>
            Description
          </label>
          <span className="text-caption text-ash">{descLen}/4000</span>
        </div>
        <textarea
          id="description"
          name="description"
          rows={6}
          maxLength={4000}
          placeholder="What is this event about? Who is it for? What is the format, agenda, and what should attendees expect?"
          onChange={(e) => setDescLen(e.target.value.length)}
          className="w-full resize-none rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="mode" className={labelClass}>
            Mode
          </label>
          <select id="mode" name="mode" defaultValue="online" className={selectClass}>
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Location"
          name="location"
          placeholder="e.g. Bengaluru, or a venue / city (optional)"
          maxLength={200}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="starts_at" className={labelClass}>
            Starts
          </label>
          <input id="starts_at" name="starts_at" type="datetime-local" className={dateClass} />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="ends_at" className={labelClass}>
            Ends (optional)
          </label>
          <input id="ends_at" name="ends_at" type="datetime-local" className={dateClass} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="registration_deadline" className={labelClass}>
            Registration deadline (optional)
          </label>
          <input
            id="registration_deadline"
            name="registration_deadline"
            type="datetime-local"
            className={dateClass}
          />
        </div>
        <Input
          label="Prize / perks (optional)"
          name="prize"
          placeholder="e.g. ₹2,00,000 pool + internships"
          maxLength={200}
        />
      </div>

      <Input
        label="Registration link (optional)"
        name="registration_url"
        type="url"
        inputMode="url"
        placeholder="https://..."
        maxLength={500}
      />

      <Input
        label="Tags (optional, comma separated)"
        name="tags"
        placeholder="e.g. ai, web3, design"
      />

      {/* Cover image: upload a file, or paste an image URL below. */}
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Cover image (optional)</span>
        {imagePreview ? (
          <div className="relative overflow-hidden rounded-lg border border-bone">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagePreview} alt="" className="aspect-[16/9] w-full object-cover" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Remove image"
              className="absolute right-2 top-2 rounded-full bg-ink/70 p-1.5 text-cream transition-colors hover:bg-ink"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-ink/20 bg-cream/40 text-ash transition-colors hover:border-saffron/50 hover:text-ink"
          >
            <ImagePlus className="size-6" />
            <span className="text-sm font-medium">Upload a cover image</span>
            <span className="text-xs">JPG, PNG, or WebP</span>
          </button>
        )}
        <input
          ref={imageInputRef}
          type="file"
          name="image"
          accept={IMAGE_ACCEPT}
          onChange={onPickImage}
          className="hidden"
        />
        <Input
          name="image_url"
          type="url"
          inputMode="url"
          placeholder="...or paste an image URL (used when no file is selected)"
          maxLength={500}
        />
      </div>

      {error ? <p className="text-sm text-ember">{error}</p> : null}

      <div className="flex items-center gap-4 pt-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Publishing..." : "Publish event"}
        </Button>
      </div>
    </form>
  );
}
