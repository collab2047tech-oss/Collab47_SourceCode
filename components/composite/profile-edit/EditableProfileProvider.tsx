"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { updateProfileAction } from "@/app/(app)/profile/edit/actions";

/**
 * The full set of profile values the inline editors read and write. Every value
 * is always present (empty string / number, never undefined) so that a save is
 * ALWAYS a complete snapshot. This matters because `updateProfileAction` treats
 * a missing field as "clear it": a partial FormData (e.g. avatar-only) would
 * blank the name/bio/banner. Sending the whole merged state keeps every
 * untouched field identical to what is already stored, so updateProfile's
 * unchanged-value guards leave them alone.
 */
export interface ProfileValues {
  name: string;
  /** Honorific chip (Mr/Dr/...), "" when none. */
  title: string;
  bio: string;
  college: string;
  branch: string;
  year_of_study: string;
  city: string;
  avatar_url: string; // "" = no avatar
  cover_url: string; // "" = no uploaded cover
  banner_preset: string; // "" = upload mode (cover_url / focal are used)
  cover_focal_x: number;
  cover_focal_y: number;
  // Read-only display context (never edited here).
  handle: string;
  verified: boolean;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

interface EditableProfileContextValue {
  values: ProfileValues;
  /** Merge a patch, persist the whole snapshot, roll back on failure. */
  save: (patch: Partial<ProfileValues>) => Promise<SaveResult>;
}

const EditableProfileContext = createContext<EditableProfileContextValue | null>(null);

export function useEditableProfile(): EditableProfileContextValue {
  const ctx = useContext(EditableProfileContext);
  if (!ctx) {
    throw new Error("useEditableProfile must be used inside <EditableProfileProvider>");
  }
  return ctx;
}

/**
 * Build the complete FormData `updateProfileAction` expects, encoding the exact
 * mutually-exclusive banner rules used by ProfileEditForm.tsx:
 *   - preset chosen  -> banner_preset set, cover cleared
 *   - upload mode    -> banner_preset cleared, cover_url + focal persisted
 * `title` is always included; the action reads it only when present (`has`), so
 * the legacy full-page editor is unaffected.
 */
function buildFormData(v: ProfileValues): FormData {
  const d = new FormData();
  d.set("name", v.name);
  d.set("title", v.title);
  d.set("bio", v.bio);
  d.set("college", v.college);
  d.set("branch", v.branch);
  d.set("year_of_study", v.year_of_study);
  d.set("city", v.city);

  // Avatar: send the URL to keep it, or an explicit removal.
  if (v.avatar_url) {
    d.set("avatar_url", v.avatar_url);
  } else {
    d.set("avatar_url", "");
    d.set("avatar_removed", "true");
  }

  // Banner: preset and uploaded cover are mutually exclusive.
  if (v.banner_preset) {
    d.set("banner_preset", v.banner_preset);
    d.set("cover_url", "");
    d.set("cover_removed", "true");
  } else {
    d.set("banner_preset", "");
    if (v.cover_url) {
      d.set("cover_url", v.cover_url);
    } else {
      d.set("cover_url", "");
      d.set("cover_removed", "true");
    }
    d.set("cover_focal_x", String(v.cover_focal_x));
    d.set("cover_focal_y", String(v.cover_focal_y));
  }
  return d;
}

export function EditableProfileProvider({
  initial,
  children,
}: {
  initial: ProfileValues;
  children: React.ReactNode;
}) {
  const [values, setValues] = useState<ProfileValues>(initial);
  // Always-current snapshot so overlapping saves merge onto the latest state.
  const valuesRef = useRef(values);
  valuesRef.current = values;
  const savingRef = useRef(false);

  // Reconcile with the server after a successful save (the action revalidates +
  // redirects, so /profile re-renders with fresh props). Only sync when idle so
  // an in-flight optimistic update is never clobbered.
  const initialSig = JSON.stringify(initial);
  const lastSig = useRef(initialSig);
  useEffect(() => {
    if (initialSig !== lastSig.current && !savingRef.current) {
      lastSig.current = initialSig;
      setValues(initial);
    }
  }, [initialSig, initial]);

  const save = useCallback(async (patch: Partial<ProfileValues>): Promise<SaveResult> => {
    const prev = valuesRef.current;
    const next = { ...prev, ...patch };
    valuesRef.current = next;
    setValues(next); // optimistic
    savingRef.current = true;
    try {
      // On success the action redirects (resolves undefined); on failure it
      // returns { ok:false, error }.
      const result = await updateProfileAction(buildFormData(next));
      if (result && !result.ok) {
        valuesRef.current = prev;
        setValues(prev); // roll back
        return { ok: false, error: result.error ?? "Could not save. Please try again." };
      }
      return { ok: true };
    } catch {
      valuesRef.current = prev;
      setValues(prev);
      return { ok: false, error: "Something went wrong. Please try again." };
    } finally {
      savingRef.current = false;
    }
  }, []);

  return (
    <EditableProfileContext.Provider value={{ values, save }}>
      {children}
    </EditableProfileContext.Provider>
  );
}
