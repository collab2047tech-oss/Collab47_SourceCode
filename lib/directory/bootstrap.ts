/**
 * Day-one BOOTSTRAP directory data.
 *
 * `bootstrap.json` is the single source of truth (so the .mjs seeder, which
 * cannot import TypeScript, reads the exact same file). It holds:
 *   - institutions: the app's curated list of real Indian institutions
 *     (same names the onboarding CollegeCombobox uses), with HQ city/state.
 *   - startups: real, verifiable DPIIT-recognized Indian companies (HQ city).
 *
 * City/state are filled only where confidently known - never invented. This list
 * makes the pickers work immediately; the nightly data.gov.in sync (once a key is
 * configured) UPSERTs the full government datasets on top, overriding these rows.
 */
import raw from "./bootstrap.json";
import type { DirectoryEntryInput } from "./types";

interface RawEntry {
  name: string;
  city: string | null;
  state: string | null;
}

const data = raw as { institutions: RawEntry[]; startups: RawEntry[] };

export const BOOTSTRAP_ENTRIES: DirectoryEntryInput[] = [
  ...data.institutions.map((e) => ({
    kind: "institution" as const,
    name: e.name,
    city: e.city ?? null,
    state: e.state ?? null,
    source: "bootstrap",
    sourceRef: null,
  })),
  ...data.startups.map((e) => ({
    kind: "startup" as const,
    name: e.name,
    city: e.city ?? null,
    state: e.state ?? null,
    source: "bootstrap",
    sourceRef: null,
  })),
];
