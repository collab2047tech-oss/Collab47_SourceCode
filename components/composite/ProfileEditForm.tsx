"use client";

import { useTransition, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { updateProfileAction } from "@/app/(app)/profile/edit/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { prepareImageForUpload, IMAGE_ACCEPT } from "@/lib/media/compress";
import type { ProfileLinks } from "@/lib/supabase/types";
import { ProfileBanner } from "@/components/composite/ProfileBanner";
import { BANNER_PRESETS, BANNER_FAMILIES, DEFAULT_BANNER, type BannerFamily } from "@/lib/data/banners";
import { Check, Move, RotateCcw, Upload } from "lucide-react";

const MAX_COVER_BYTES = 1_048_576; // 1 MB hard cap

const BRANCHES = [
  "CSE",
  "IT",
  "ECE",
  "EEE",
  "Mechanical",
  "Civil",
  "Chemical",
  "Biotechnology",
  "Mathematics",
  "Physics",
  "Commerce",
  "Economics",
  "MBA",
  "Law",
  "Design",
  "Architecture",
  "Other",
];

const YEARS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year (Final)" },
  { value: "5", label: "5th Year" },
];

interface ProfileEditFormProps {
  name: string;
  handle: string;
  bio: string;
  college: string;
  branch: string;
  year_of_study: string;
  city: string;
  avatar_url: string | null;
  cover_url: string | null;
  banner_preset: string | null;
  cover_focal_x: number;
  cover_focal_y: number;
  links?: ProfileLinks | null;
}

type BannerMode = "preset" | "upload";

export function ProfileEditForm({
  name,
  handle,
  bio,
  college,
  branch,
  year_of_study,
  city,
  avatar_url,
  cover_url,
  banner_preset,
  cover_focal_x,
  cover_focal_y,
  links,
}: ProfileEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [bioLen, setBioLen] = useState(bio.length);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatar_url);
  // Tracks intent to clear the saved avatar so "Remove" actually persists.
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Banner state -------------------------------------------------------
  // A banner is EITHER an uploaded cover (with focal point) OR a preset id.
  const [bannerMode, setBannerMode] = useState<BannerMode>(cover_url ? "upload" : "preset");
  const [presetId, setPresetId] = useState<string>(banner_preset || DEFAULT_BANNER);
  const [coverPreview, setCoverPreview] = useState<string | null>(cover_url);
  const [focalX, setFocalX] = useState<number>(cover_focal_x ?? 50);
  const [focalY, setFocalY] = useState<number>(cover_focal_y ?? 50);
  const [family, setFamily] = useState<BannerFamily>("gradient");
  const stageRef = useRef<HTMLDivElement>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarPreview(URL.createObjectURL(file));
      setAvatarRemoved(false);
    }
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setCoverPreview(URL.createObjectURL(file));
    setBannerMode("upload");
    setFocalX(50);
    setFocalY(50);
  }

  // Drag-to-reposition: map the pointer to a 0..100 focal point.
  const repositionFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, Math.round(((clientX - r.left) / r.width) * 100)));
    const y = Math.min(100, Math.max(0, Math.round(((clientY - r.top) / r.height) * 100)));
    setFocalX(x);
    setFocalY(y);
  }, []);

  function handleStagePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    repositionFromPointer(e.clientX, e.clientY);
  }
  function handleStagePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (e.buttons !== 1) return;
    repositionFromPointer(e.clientX, e.clientY);
  }

  async function uploadImage(
    sb: NonNullable<ReturnType<typeof getSupabaseBrowser>>,
    userId: string,
    file: File,
    bucket: "avatars" | "covers"
  ): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${userId}/${Date.now()}.${ext}`;
    const { error: upErr } = await sb.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });
    if (upErr) throw upErr;
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    // Files are uploaded client-side; never send them through the action.
    data.delete("avatar");
    data.delete("cover");
    const avatarFile = avatarInputRef.current?.files?.[0] ?? null;
    // Only treat the cover input as "uploading" when we are in upload mode AND
    // a fresh file is staged. Picking a preset must never re-upload.
    const coverFile = bannerMode === "upload" ? (coverInputRef.current?.files?.[0] ?? null) : null;

    setError(null);
    startTransition(async () => {
      const sb = getSupabaseBrowser();
      if (sb && (avatarFile || coverFile)) {
        const {
          data: { user },
        } = await sb.auth.getUser();
        if (!user) {
          setError("Please sign in again.");
          return;
        }
        try {
          if (avatarFile) {
            const toUpload = await prepareImageForUpload(avatarFile);
            data.set("avatar_url", await uploadImage(sb, user.id, toUpload, "avatars"));
          }
          if (coverFile) {
            const toUpload = await prepareImageForUpload(coverFile);
            // Hard 1 MB guard the brief requires (compression targets ~1 MB).
            if (toUpload.size > MAX_COVER_BYTES) {
              setError("Cover image is too large after compression. Please use an image under 1 MB.");
              return;
            }
            data.set("cover_url", await uploadImage(sb, user.id, toUpload, "covers"));
          }
        } catch (err) {
          setError(err instanceof Error ? `Image upload failed: ${err.message}` : "Image upload failed.");
          return;
        }
      }

      // Banner persistence rules (mutually exclusive):
      if (bannerMode === "preset") {
        // Preset chosen -> store the preset id, clear the uploaded cover.
        data.set("banner_preset", presetId);
        data.set("cover_url", "");
        data.set("cover_removed", "true");
      } else {
        // Upload mode -> store focal point, clear the preset.
        data.set("banner_preset", "");
        data.set("cover_focal_x", String(focalX));
        data.set("cover_focal_y", String(focalY));
        // If the user is in upload mode but never staged a new file, keep the
        // existing cover_url by NOT setting it (action leaves it unchanged).
      }

      // Persist avatar removal (only when the user did not pick a new file).
      if (avatarRemoved && !avatarFile) {
        data.set("avatar_url", "");
        data.set("avatar_removed", "true");
      }
      const result = await updateProfileAction(data);
      // On success the action redirects and never returns; a returned value
      // means it failed validation/save, so surface the error to the user.
      if (result && !result.ok) {
        setError(result.error ?? "Could not save your profile. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* ---- Banner editor: presets OR upload + reposition ---- */}
      <div className="rounded-lg border border-bone bg-paper p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-ink">Banner</h2>
        <p className="mt-1 text-sm text-ash">
          Pick a built-in banner or upload your own. This is what everyone sees at the top of your profile.
        </p>

        {/* Live preview - exactly what visitors will see */}
        <div className="mt-4">
          <ProfileBanner
            coverUrl={bannerMode === "upload" ? coverPreview : null}
            bannerPreset={bannerMode === "preset" ? presetId : null}
            focalX={focalX}
            focalY={focalY}
            className="h-32 rounded-xl sm:h-40"
            priority
          />
        </div>

        {/* Mode tabs */}
        <div className="mt-4 inline-flex rounded-lg border border-bone bg-cream p-1">
          {([
            { id: "preset" as BannerMode, label: "Presets" },
            { id: "upload" as BannerMode, label: "Upload" },
          ]).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setBannerMode(m.id)}
              className={
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors " +
                (bannerMode === m.id ? "bg-paper text-ink shadow-sm" : "text-ash hover:text-ink")
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* PRESETS */}
        {bannerMode === "preset" ? (
          <div className="mt-4">
            {/* Family filter */}
            <div className="flex flex-wrap gap-2">
              {BANNER_FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFamily(f.id)}
                  className={
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors " +
                    (family === f.id ? "border-transparent bg-ink text-cream" : "border-bone text-ash hover:text-ink")
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Preset grid */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {BANNER_PRESETS.filter((b) => b.family === family).map((b) => {
                const selected = bannerMode === "preset" && presetId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setPresetId(b.id);
                      setBannerMode("preset");
                    }}
                    aria-pressed={selected}
                    className="group relative block overflow-hidden rounded-lg text-left"
                    style={{ boxShadow: selected ? "0 0 0 2px #B95402" : "0 0 0 1px #E7E0D6" }}
                  >
                    <ProfileBanner bannerPreset={b.id} className="h-16 sm:h-20" />
                    {selected ? (
                      <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-paper shadow">
                        <Check className="size-3" strokeWidth={3} style={{ color: "#B95402" }} />
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
        ) : null}

        {/* UPLOAD + REPOSITION */}
        {bannerMode === "upload" ? (
          <div className="mt-4">
            {coverPreview ? (
              <>
                <div
                  ref={stageRef}
                  onPointerDown={handleStagePointerDown}
                  onPointerMove={handleStagePointerMove}
                  className="relative h-40 w-full cursor-grab touch-none select-none overflow-hidden rounded-xl border border-bone bg-cream active:cursor-grabbing sm:h-52"
                  role="slider"
                  aria-label="Drag to reposition your cover"
                  aria-valuetext={`Focal point ${focalX}% from left, ${focalY}% from top`}
                >
                  <img
                    src={coverPreview}
                    alt="Cover preview"
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
                  <Button type="button" variant="secondary" size="sm" onClick={() => coverInputRef.current?.click()}>
                    <Upload className="size-3.5" /> Replace image
                  </Button>
                  <button
                    type="button"
                    onClick={() => { setFocalX(50); setFocalY(50); }}
                    className="inline-flex items-center gap-1.5 text-xs text-ash transition-colors hover:text-ink"
                  >
                    <RotateCcw className="size-3.5" /> Reset to center
                  </button>
                </div>
                <p className="mt-2 text-xs text-ash">Images are compressed to under 1 MB. Drag the image to choose what shows.</p>
              </>
            ) : (
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-bone bg-cream text-ash transition-colors hover:border-saffron hover:text-ink sm:h-52"
              >
                <Upload className="size-6" strokeWidth={1.5} />
                <span className="text-sm font-medium">Upload a cover image</span>
                <span className="text-xs">Up to 1 MB. We compress it for you.</span>
              </button>
            )}
          </div>
        ) : null}

        <input
          ref={coverInputRef}
          type="file"
          name="cover"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={handleCoverChange}
        />
      </div>

      {/* Avatar + name + handle */}
      <div className="rounded-lg border border-bone bg-paper p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-ink">Profile photo</h2>
        <p className="mt-1 text-sm text-ash">A clear headshot works best. Square images look sharpest.</p>
        <div className="mt-6 flex items-center gap-6">
          <Avatar
            name={name || "User"}
            src={avatarPreview ?? undefined}
            size="2xl"
          />
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => avatarInputRef.current?.click()}
            >
              Upload new
            </Button>
            {avatarPreview && (
              <button
                type="button"
                className="text-xs text-ash hover:text-ink transition-colors"
                onClick={() => {
                  setAvatarPreview(null);
                  setAvatarRemoved(true);
                  if (avatarInputRef.current) avatarInputRef.current.value = "";
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          name="avatar"
          accept={IMAGE_ACCEPT}
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Basic info */}
      <div className="rounded-lg border border-bone bg-paper p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-ink">Basic info</h2>
        <p className="mt-1 text-sm text-ash">Your name and handle are public.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="Full name"
            name="name"
            defaultValue={name}
            required
            placeholder="Your full name"
          />
          <div className="flex w-full flex-col gap-2">
            <label className="text-caption text-ink">Handle</label>
            <input
              name="handle"
              defaultValue={handle}
              disabled
              className="h-12 w-full rounded-md border border-ink/10 bg-cream px-4 text-base text-ash cursor-not-allowed"
            />
            <p className="text-xs text-ash">Handle cannot be changed after signup.</p>
          </div>
          <Input
            label="City"
            name="city"
            defaultValue={city}
            placeholder="e.g. your city"
          />
        </div>
        <div className="mt-4 flex w-full flex-col gap-2">
          <label htmlFor="bio" className="text-caption text-ink">Bio</label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={bio}
            maxLength={280}
            rows={4}
            placeholder="Tell the network what you are building, studying, or exploring..."
            onChange={(e) => setBioLen(e.target.value.length)}
            className="w-full rounded-md border border-ink/15 bg-paper px-4 py-3 text-base text-ink placeholder:text-ash transition-colors focus:border-ink focus:outline-none resize-none"
          />
          <p className="text-xs text-ash text-right">{bioLen}/280</p>
        </div>
      </div>

      {/* Academic info */}
      <div className="rounded-lg border border-bone bg-paper p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-ink">Academic</h2>
        <p className="mt-1 text-sm text-ash">Used by the feed ranker and college leaderboard.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="College"
            name="college"
            defaultValue={college}
            placeholder="e.g. Punjabi University"
          />
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="branch" className="text-caption text-ink">Branch</label>
            <select
              id="branch"
              name="branch"
              defaultValue={branch}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none"
            >
              <option value="">Select branch</option>
              {BRANCHES.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="flex w-full flex-col gap-2">
            <label htmlFor="year_of_study" className="text-caption text-ink">Year of study</label>
            <select
              id="year_of_study"
              name="year_of_study"
              defaultValue={year_of_study}
              className="h-12 w-full rounded-md border border-ink/15 bg-paper px-4 text-base text-ink transition-colors focus:border-ink focus:outline-none"
            >
              <option value="">Select year</option>
              {YEARS.map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Links - HIDDEN FOR NOW (kept in code, not deleted). Flip false -> true
          to restore. IMPORTANT: the matching links plumbing in
          app/(app)/profile/edit/actions.ts is commented out in lockstep. Restore
          BOTH together: re-enabling only one of them wipes saved links on save. */}
      {false && (
      <div className="rounded-lg border border-bone bg-paper p-5 sm:p-6">
        <h2 className="font-serif text-2xl text-ink">Links</h2>
        <p className="mt-1 text-sm text-ash">
          Add your website and socials. Paste a full URL or just your handle.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Input
            label="Website"
            name="link_website"
            defaultValue={links?.website ?? ""}
            placeholder="yoursite.com"
          />
          <Input
            label="GitHub"
            name="link_github"
            defaultValue={links?.github ?? ""}
            placeholder="username"
          />
          <Input
            label="LinkedIn"
            name="link_linkedin"
            defaultValue={links?.linkedin ?? ""}
            placeholder="username"
          />
          <Input
            label="Instagram"
            name="link_instagram"
            defaultValue={links?.instagram ?? ""}
            placeholder="@username"
          />
          <Input
            label="Twitter / X"
            name="link_twitter"
            defaultValue={links?.twitter ?? ""}
            placeholder="@username"
          />
          <Input
            label="YouTube"
            name="link_youtube"
            defaultValue={links?.youtube ?? ""}
            placeholder="@channel"
          />
        </div>
      </div>
      )}

      {/* Actions */}
      {error ? <p className="text-sm text-ember">{error}</p> : null}
      <div className="flex items-center gap-4 pb-12">
        <Button type="submit" size="md" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
        <Link
          href="/profile"
          className="text-sm text-ash hover:text-ink transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
