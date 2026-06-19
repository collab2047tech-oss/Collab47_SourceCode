"use client";

import { useTransition, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { updateProfileAction } from "@/app/(app)/profile/edit/actions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { compressImage } from "@/lib/media/compress";

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
}

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
}: ProfileEditFormProps) {
  const [isPending, startTransition] = useTransition();
  const [bioLen, setBioLen] = useState(bio.length);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatar_url);
  const [coverPreview, setCoverPreview] = useState<string | null>(cover_url);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAvatarPreview(URL.createObjectURL(file));
  }

  function handleCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setCoverPreview(URL.createObjectURL(file));
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
    const coverFile = coverInputRef.current?.files?.[0] ?? null;

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
            const toUpload = await compressImage(avatarFile);
            data.set("avatar_url", await uploadImage(sb, user.id, toUpload, "avatars"));
          }
          if (coverFile) {
            const toUpload = await compressImage(coverFile);
            data.set("cover_url", await uploadImage(sb, user.id, toUpload, "covers"));
          }
        } catch (err) {
          setError(err instanceof Error ? `Image upload failed: ${err.message}` : "Image upload failed.");
          return;
        }
      }
      await updateProfileAction(data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Cover upload */}
      <div className="rounded-lg border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Cover photo</h2>
        <p className="mt-1 text-sm text-ash">Displayed at the top of your profile.</p>
        <div
          className="mt-4 relative h-40 w-full rounded-lg border border-bone bg-cream overflow-hidden cursor-pointer"
          onClick={() => coverInputRef.current?.click()}
        >
          {coverPreview ? (
            <img src={coverPreview} alt="Cover preview" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-[linear-gradient(135deg,#1F3A2C_0%,#0A0A0B_100%)]" />
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-ink/30 opacity-0 hover:opacity-100 transition-opacity">
            <span className="text-sm font-medium text-cream">Change cover</span>
          </div>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          name="cover"
          accept="image/*"
          className="hidden"
          onChange={handleCoverChange}
        />
      </div>

      {/* Avatar + name + handle */}
      <div className="rounded-lg border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Avatar</h2>
        <p className="mt-1 text-sm text-ash">Square images work best.</p>
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
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
      </div>

      {/* Basic info */}
      <div className="rounded-lg border border-bone bg-paper p-6">
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
            placeholder="e.g. Amritsar"
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
      <div className="rounded-lg border border-bone bg-paper p-6">
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
