"use client";

import { Reveal } from "@/components/motion/Reveal";
import { PushToggle } from "@/components/composite/PushToggle";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Input } from "@/components/primitives/Input";
import { useState, useTransition } from "react";
import { cn } from "@/lib/cn";
import { updateDmPermissionAction } from "@/app/(app)/messages/actions";
import {
  updateAccountAction,
  updatePrivacyAction,
  updateNotificationPrefsAction,
  deleteAccountAction,
  signOutAction,
} from "@/app/(app)/settings/actions";
import type { DMPermission } from "@/lib/supabase/types";
import {
  User,
  Lock,
  Bell,
  Globe,
  CreditCard,
  LogOut,
  Trash2,
  MessageSquare,
  Check,
} from "lucide-react";

/** A change-limited field's current window state, computed server-side. */
interface ChangeWindowState {
  /** True when the field is locked (a change happened < 7 days ago). */
  locked: boolean;
  /** ISO timestamp of when the field unlocks, or null if never changed. */
  nextAt: string | null;
}

export interface SettingsInitial {
  name: string;
  handle: string;
  email: string;
  college: string;
  branch: string;
  year_of_study: string;
  dm_permission: DMPermission;
  /** Saved privacy settings from the database. Null when the row has no value yet. */
  privacy: {
    public_profile: boolean;
    searchable: boolean;
    read_receipts: boolean;
  } | null;
  /** Saved notification prefs from the database. Null when the row has no value yet. */
  notificationPrefs: Record<string, { email: boolean; push: boolean }> | null;
  /** 7-day change window for the full name. */
  nameChange: ChangeWindowState;
  /** 7-day change window for the handle. */
  handleChange: ChangeWindowState;
}

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "dms", label: "DM Permissions", icon: MessageSquare },
  { id: "language", label: "Language", icon: Globe },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

type Section = typeof sections[number]["id"];

// ---------------------------------------------------------------------------
// Shared switch primitive: high-contrast in BOTH states (never relies on a
// dim text color to signal off). On = cobalt track, knob right. Off = bone
// track with an ink border, knob left.
// ---------------------------------------------------------------------------

function Switch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        disabled && "cursor-not-allowed opacity-50",
        on
          ? "border-saffron bg-saffron"
          : "border-ink/30 bg-bone"
      )}
    >
      <span
        className={cn(
          "inline-block size-4.5 transform rounded-full bg-paper shadow-sm transition-transform duration-200",
          on ? "translate-x-5.5" : "translate-x-0.75"
        )}
      />
    </button>
  );
}

/** Friendly "in N days (on Mon D)" using the India locale. No em dashes. */
function formatUnlock(nextAt: string | null): string {
  if (!nextAt) return "";
  const next = new Date(nextAt);
  const days = Math.max(1, Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  const date = next.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return `Available again on ${date} (in ${days} ${days === 1 ? "day" : "days"}).`;
}

// ---------------------------------------------------------------------------
// DM permissions
// ---------------------------------------------------------------------------

const DM_OPTIONS: Array<{ value: DMPermission; label: string; desc: string }> = [
  {
    value: "everyone",
    label: "Everyone",
    desc: "Anyone can send you a message. Strangers go to Requests.",
  },
  {
    value: "connections",
    label: "Connections only",
    desc: "Only accepted connections can message you directly.",
  },
  {
    value: "nobody",
    label: "Nobody",
    desc: "Close your DMs entirely. No new messages allowed.",
  },
];

function DmPermissionsSection({ initial }: { initial: DMPermission }) {
  const [selected, setSelected] = useState<DMPermission>(initial);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Optimistic: the radio moves instantly; the save runs in the background and
  // rolls back on failure.
  function choose(next: DMPermission) {
    if (next === selected) return;
    const prev = selected;
    setSelected(next);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await updateDmPermissionAction(next);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setSelected(prev);
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">DM Permissions</h2>
      <p className="mt-1 text-sm text-ash">Control who can send you direct messages.</p>
      <ul className="mt-6 space-y-3">
        {DM_OPTIONS.map((opt) => (
          <li key={opt.value}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors",
                selected === opt.value
                  ? "border-saffron bg-saffron/5"
                  : "border-bone hover:bg-cream"
              )}
            >
              <input
                type="radio"
                name="dm_permission"
                value={opt.value}
                checked={selected === opt.value}
                onChange={() => choose(opt.value)}
                className="mt-0.5 accent-saffron"
              />
              <div>
                <p className="text-sm font-semibold text-ink">{opt.label}</p>
                <p className="mt-0.5 text-sm text-ash">{opt.desc}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex h-5 items-center gap-4 text-sm">
        {isPending && <span className="text-ash">Saving...</span>}
        {saved && !isPending && <span className="font-medium text-moss">Saved.</span>}
        {error && <span className="text-ember">{error}</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Account section (Profile identity + Academic), with the 7-day change limit.
// ---------------------------------------------------------------------------

function AccountSection({ initial }: { initial: SettingsInitial }) {
  const [profilePending, startProfileTransition] = useTransition();
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [academicPending, startAcademicTransition] = useTransition();
  const [academicSaved, setAcademicSaved] = useState(false);
  const [academicError, setAcademicError] = useState<string | null>(null);

  // Track the current field values so we can pre-validate the 7-day window on
  // the client: a locked field only matters if the user actually edits it.
  const [name, setName] = useState(initial.name);
  const [handle, setHandle] = useState(initial.handle);

  const nameLocked = initial.nameChange.locked;
  const handleLocked = initial.handleChange.locked;
  const nameEdited = name.trim() !== initial.name.trim();
  const handleEdited = handle.trim().toLowerCase() !== initial.handle.trim().toLowerCase();

  function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProfileError(null);

    // Client-side guard: never fire a request for a locked field that changed.
    if (nameEdited && nameLocked) {
      setProfileError(`Name change is locked. ${formatUnlock(initial.nameChange.nextAt)}`);
      return;
    }
    if (handleEdited && handleLocked) {
      setProfileError(`Username change is locked. ${formatUnlock(initial.handleChange.nextAt)}`);
      return;
    }

    const data = new FormData(e.currentTarget);
    startProfileTransition(async () => {
      const result = await updateAccountAction(data);
      if (result.ok) {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      } else {
        setProfileError(result.error ?? "Something went wrong.");
      }
    });
  }

  function handleAcademicSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setAcademicError(null);
    startAcademicTransition(async () => {
      const result = await updateAccountAction(data);
      if (result.ok) {
        setAcademicSaved(true);
        setTimeout(() => setAcademicSaved(false), 2500);
      } else {
        setAcademicError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ash">How others see you across Collab47.</p>

        <div className="mt-6 flex items-center gap-5">
          <Avatar name={initial.name} size="2xl" />
          <a href="/profile/edit">
            <Button variant="secondary" size="sm">
              Change photo in profile
            </Button>
          </a>
        </div>

        <form onSubmit={handleProfileSubmit} id="account-form">
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div>
              <Input
                label="Full name"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={nameLocked}
              />
              <p className="mt-1.5 text-xs text-ash">
                {nameLocked ? (
                  <span className="text-ember">{formatUnlock(initial.nameChange.nextAt)}</span>
                ) : (
                  "You can change this once every 7 days."
                )}
              </p>
            </div>
            <div>
              <Input
                label="Handle"
                name="handle"
                value={handle}
                onChange={(e) => setHandle(e.target.value.toLowerCase())}
                disabled={handleLocked}
              />
              <p className="mt-1.5 text-xs text-ash">
                {handleLocked ? (
                  <span className="text-ember">{formatUnlock(initial.handleChange.nextAt)}</span>
                ) : (
                  "3-32 lowercase letters, numbers, or underscores. Changeable once every 7 days."
                )}
              </p>
            </div>
            <div>
              <Input label="Email" value={initial.email} disabled />
              <p className="mt-1.5 text-xs text-ash">Your email is private and cannot be changed here.</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button type="submit" size="md" disabled={profilePending}>
              {profilePending ? "Saving..." : "Save changes"}
            </Button>
            {profileSaved && <p className="text-sm font-medium text-moss">Saved.</p>}
            {profileError && <p className="text-sm text-ember">{profileError}</p>}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Academic</h2>
        <p className="mt-1 text-sm text-ash">Used by the feed ranker and college leaderboard.</p>
        <form onSubmit={handleAcademicSubmit}>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <Input label="College" name="college" defaultValue={initial.college} />
            <Input label="Branch" name="branch" defaultValue={initial.branch} />
            <Input label="Year of study" name="year_of_study" defaultValue={initial.year_of_study} />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button type="submit" size="md" disabled={academicPending}>
              {academicPending ? "Saving..." : "Save changes"}
            </Button>
            {academicSaved && <p className="text-sm font-medium text-moss">Saved.</p>}
            {academicError && <p className="text-sm text-ember">{academicError}</p>}
          </div>
        </form>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Privacy section: public/private master switch + searchable + read receipts.
// Toggles are optimistic and auto-save (no separate Save button).
// ---------------------------------------------------------------------------

function PrivacySection({ initialPrivacy }: { initialPrivacy: SettingsInitial["privacy"] }) {
  const start = {
    public_profile: initialPrivacy?.public_profile ?? true,
    searchable: initialPrivacy?.searchable ?? true,
    read_receipts: initialPrivacy?.read_receipts ?? false,
  };
  const [values, setValues] = useState(start);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Optimistic toggle: flip locally now, persist in the background, roll back on
  // failure. One save sends the full set so the merge on the server is stable.
  function set(key: keyof typeof values, next: boolean) {
    const prev = values;
    const updated = { ...values, [key]: next };
    setValues(updated);
    setError(null);
    setSavedKey(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("public_profile", String(updated.public_profile));
      data.set("searchable", String(updated.searchable));
      data.set("read_receipts", String(updated.read_receipts));
      const result = await updatePrivacyAction(data);
      if (result.ok) {
        setSavedKey(key);
        setTimeout(() => setSavedKey(null), 2500);
      } else {
        setValues(prev);
        setError("Could not save. Try again.");
      }
    });
  }

  const isPrivate = !values.public_profile;

  return (
    <section className="rounded-2xl border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">Privacy</h2>
      <p className="mt-1 text-sm text-ash">Control who sees your posts and projects.</p>

      {/* Private account master switch */}
      <div className="mt-6 rounded-xl border border-bone bg-cream/60 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Private account</p>
            <p className="mt-1 max-w-md text-sm text-ash">
              {isPrivate
                ? "Only your connections can see your posts and projects. You stay discoverable in search."
                : "Anyone can see your posts and projects. Turn this on to limit your content to connections."}
            </p>
          </div>
          <Switch
            label="Private account"
            on={isPrivate}
            onChange={() => set("public_profile", isPrivate ? true : false)}
          />
        </div>
        {savedKey === "public_profile" && (
          <p className="mt-2 text-xs font-medium text-moss">Saved.</p>
        )}
      </div>

      <ul className="mt-6 space-y-1">
        <li className="flex items-center justify-between gap-4 border-b border-bone py-4">
          <div>
            <p className="text-sm font-semibold text-ink">Hide from search and suggestions</p>
            <p className="mt-0.5 text-sm text-ash">
              Remove yourself from search results and people suggestions entirely.
            </p>
            {savedKey === "searchable" && <p className="mt-1 text-xs font-medium text-moss">Saved.</p>}
          </div>
          <Switch
            label="Hide from search and suggestions"
            on={!values.searchable}
            onChange={() => set("searchable", !values.searchable ? true : false)}
          />
        </li>
        <li className="flex items-center justify-between gap-4 py-4">
          <div>
            <p className="text-sm font-semibold text-ink">Read receipts in messages</p>
            <p className="mt-0.5 text-sm text-ash">
              Let people see when you have read their direct messages.
            </p>
            {savedKey === "read_receipts" && <p className="mt-1 text-xs font-medium text-moss">Saved.</p>}
          </div>
          <Switch
            label="Read receipts in messages"
            on={values.read_receipts}
            onChange={() => set("read_receipts", !values.read_receipts)}
          />
        </li>
      </ul>

      <div className="mt-2 flex h-5 items-center gap-4 text-sm">
        {isPending && <span className="text-ash">Saving...</span>}
        {error && <span className="text-ember">{error}</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notifications: only In-app is real today. Email + Push are honestly marked
// "Coming soon" (disabled) but their prefs still persist for when they wire up.
// ---------------------------------------------------------------------------

const NOTIF_EVENTS = [
  { key: "new_follower", label: "New follower" },
  { key: "direct_messages", label: "Direct messages" },
  { key: "branch_news", label: "Career-Impact news for your branch" },
  { key: "project_invites", label: "Collab Project invites" },
  { key: "weekly_digest", label: "Weekly digest" },
];

function NotificationsSection({
  initialNotificationPrefs,
}: {
  initialNotificationPrefs: SettingsInitial["notificationPrefs"];
}) {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; push: boolean }>>(() =>
    Object.fromEntries(
      NOTIF_EVENTS.map((e) => [e.key, initialNotificationPrefs?.[e.key] ?? { email: false, push: false }])
    )
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Optimistic email toggle (push is disabled until web-push exists).
  function toggleEmail(key: string) {
    const prev = prefs;
    const updated = { ...prefs, [key]: { ...prefs[key], email: !prefs[key].email } };
    setPrefs(updated);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const data = new FormData();
      for (const [k, v] of Object.entries(updated)) {
        data.set(`${k}_email`, String(v.email));
        data.set(`${k}_push`, String(v.push));
      }
      const result = await updateNotificationPrefsAction(data);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setPrefs(prev);
        setError("Could not save. Try again.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">Notifications</h2>
      <p className="mt-1 text-sm text-ash">
        In-app notifications are always on. Turn on push to get alerts on this device. Email is coming soon.
      </p>

      <div className="mt-5">
        <PushToggle />
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_auto] items-center gap-x-3 gap-y-1 sm:gap-x-6">
        <span />
        <span className="text-center text-caption tracking-widest text-ash">In-app</span>
        <span className="flex flex-col items-center text-center">
          <span className="text-caption tracking-widest text-ash/60">Email</span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-ash/50">Coming soon</span>
        </span>

        {NOTIF_EVENTS.map((ev) => (
          <div key={ev.key} className="contents">
            <span className="min-w-0 border-t border-bone py-4 text-sm text-ink">{ev.label}</span>
            <span className="flex items-center justify-center border-t border-bone py-4">
              <span className="inline-flex size-6 items-center justify-center rounded-full bg-saffron/10 text-saffron" title="Always on">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            </span>
            <span className="flex items-center justify-center border-t border-bone py-4">
              <Switch
                label={`Email for ${ev.label} (coming soon)`}
                on={prefs[ev.key].email}
                onChange={() => toggleEmail(ev.key)}
                disabled
              />
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 rounded-lg border border-bone bg-cream/60 px-4 py-3 text-xs text-ash">
        Push notifications are live (enable them above). Per-event email controls are coming soon,
        once email delivery is switched on.
      </p>

      <div className="mt-3 flex h-5 items-center gap-4 text-sm">
        {isPending && <span className="text-ash">Saving...</span>}
        {saved && !isPending && <span className="font-medium text-moss">Saved.</span>}
        {error && <span className="text-ember">{error}</span>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function SettingsView({ initial }: { initial: SettingsInitial }) {
  const [active, setActive] = useState<Section>("account");
  const [signOutPending, startSignOutTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOutAction();
    });
  }

  function handleDeleteConfirm() {
    setConfirmDelete(false);
    startDeleteTransition(async () => {
      const result = await deleteAccountAction();
      if (result.ok) {
        // The server already signed us out. Redirect to the public home.
        window.location.href = "/";
      }
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Reveal>
        <div className="rule-top">
          <p className="text-caption">Account</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">Settings.</h1>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-10 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors",
                active === s.id ? "bg-ink text-cream" : "text-ink hover:bg-bone"
              )}
            >
              <s.icon className="size-4" />
              {s.label}
            </button>
          ))}
          <div className="my-4 h-px bg-bone" />
          <button
            onClick={handleSignOut}
            disabled={signOutPending}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ink transition-colors hover:bg-bone disabled:opacity-50"
          >
            <LogOut className="size-4" /> {signOutPending ? "Signing out..." : "Sign out"}
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            disabled={deletePending}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-ember transition-colors hover:bg-ember/10 disabled:opacity-50"
          >
            <Trash2 className="size-4" /> {deletePending ? "Deleting..." : "Delete account"}
          </button>
        </nav>

        <Reveal>
          <div className="space-y-8">
            {active === "account" && <AccountSection initial={initial} />}

            {active === "privacy" && <PrivacySection initialPrivacy={initial.privacy} />}

            {active === "notifications" && (
              <NotificationsSection initialNotificationPrefs={initial.notificationPrefs} />
            )}

            {active === "dms" && <DmPermissionsSection initial={initial.dm_permission} />}

            {active === "language" && (
              <section className="rounded-2xl border border-bone bg-paper p-6">
                <h2 className="font-serif text-2xl text-ink">Language</h2>
                <p className="mt-1 text-sm text-ash">
                  Collab47 is English at launch. More Indian languages are on the roadmap.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-saffron bg-saffron/5 px-4 py-2.5">
                  <Check className="size-4 text-saffron" strokeWidth={2.5} />
                  <span className="text-sm font-semibold text-ink">English</span>
                  <span className="text-xs text-ash">Current</span>
                </div>
              </section>
            )}

            {active === "billing" && (
              <section className="rounded-2xl border border-bone bg-paper p-6">
                <h2 className="font-serif text-2xl text-ink">Billing</h2>
                <p className="mt-1 text-sm text-ash">
                  You are on the free plan. Every core feature is included.
                </p>
                <div className="mt-6 rounded-xl border border-bone bg-cream/60 p-5">
                  <p className="font-serif text-2xl text-ink">Free plan</p>
                  <p className="mt-1 text-sm text-ash">
                    All core features. The Career-Impact engine is in preview.
                  </p>
                  <p className="mt-4 text-sm text-ink">
                    We will email you when premium opens. There is nothing to do for now.
                  </p>
                </div>
              </section>
            )}
          </div>
        </Reveal>
      </div>

      {/* Delete account confirm overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-bone bg-paper p-6 shadow-lg">
            <h3 className="font-serif text-2xl text-ink">Delete account?</h3>
            <p className="mt-3 text-sm leading-relaxed text-ash">
              Your account will be deactivated and you will be signed out. You can restore it within
              14 days by signing back in with the same email. After 14 days, your data is permanently
              removed.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="destructive"
                size="md"
                onClick={handleDeleteConfirm}
                disabled={deletePending}
              >
                Yes, delete
              </Button>
              <Button variant="secondary" size="md" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
