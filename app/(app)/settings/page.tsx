"use client";

import { Reveal } from "@/components/motion/Reveal";
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
} from "lucide-react";

const sections = [
  { id: "account", label: "Account", icon: User },
  { id: "privacy", label: "Privacy", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "dms", label: "DM Permissions", icon: MessageSquare },
  { id: "language", label: "Language", icon: Globe },
  { id: "billing", label: "Billing", icon: CreditCard },
] as const;

type Section = typeof sections[number]["id"];

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

function DmPermissionsSection() {
  const [selected, setSelected] = useState<DMPermission>("everyone");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await updateDmPermissionAction(selected);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">DM Permissions</h2>
      <p className="mt-1 text-sm text-ash">
        Control who can send you direct messages.
      </p>
      <ul className="mt-6 space-y-3">
        {DM_OPTIONS.map((opt) => (
          <li key={opt.value}>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors",
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
                onChange={() => setSelected(opt.value)}
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
      <div className="mt-6 flex items-center gap-4">
        <Button
          size="md"
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save preference"}
        </Button>
        {saved && (
          <p className="text-sm text-moss">Saved.</p>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Account section
// ---------------------------------------------------------------------------

function AccountSection() {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await updateAccountAction(data);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <>
      <section className="rounded-lg border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Profile</h2>
        <p className="mt-1 text-sm text-ash">
          How others see you across Collab47.
        </p>
        <div className="mt-6 flex items-center gap-6">
          <Avatar name="Akshpreet Singh" size="2xl" />
          <div className="flex flex-col gap-2">
            <Button variant="secondary" size="sm">
              Upload new
            </Button>
            <button className="text-xs text-ash hover:text-ink">
              Remove
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} id="account-form">
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Input label="Full name" name="name" defaultValue="Akshpreet Singh" />
            <Input label="Handle" defaultValue="akshpreet" disabled />
            <Input label="Email" defaultValue="ak@collab47.com" disabled />
            <Input label="Phone" defaultValue="+91 98000 00000" disabled />
          </div>
          <div className="mt-6 flex items-center gap-4">
            <Button type="submit" size="md" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
            {saved && <p className="text-sm text-moss">Saved.</p>}
            {error && <p className="text-sm text-ember">{error}</p>}
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-bone bg-paper p-6">
        <h2 className="font-serif text-2xl text-ink">Academic</h2>
        <p className="mt-1 text-sm text-ash">
          Used by the feed ranker and college leaderboard.
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Input label="College" name="college" defaultValue="Punjabi University" />
            <Input label="Branch" name="branch" defaultValue="CSE" />
            <Input label="Year of study" name="year_of_study" defaultValue="4" />
            <Input label="Graduation" defaultValue="2026" disabled />
          </div>
          <div className="mt-6">
            <Button type="submit" size="md" disabled={isPending}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </form>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Privacy section
// ---------------------------------------------------------------------------

const PRIVACY_ITEMS: Array<{
  key: "public_profile" | "searchable" | "read_receipts";
  label: string;
  defaultOn: boolean;
}> = [
  { key: "public_profile", label: "Public profile", defaultOn: true },
  { key: "searchable", label: "Searchable by recruiters", defaultOn: true },
  { key: "read_receipts", label: "Read receipts in messages", defaultOn: false },
];

function PrivacySection() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(PRIVACY_ITEMS.map((item) => [item.key, item.defaultOn]))
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(key: string) {
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    const data = new FormData();
    for (const [k, v] of Object.entries(toggles)) {
      data.set(k, String(v));
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePrivacyAction(data);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <section className="rounded-lg border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">Privacy</h2>
      <p className="mt-1 text-sm text-ash">
        Control who sees what.
      </p>
      <ul className="mt-6 space-y-4">
        {PRIVACY_ITEMS.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between border-b border-bone pb-4 last:border-0"
          >
            <span className="text-sm text-ink">{item.label}</span>
            <button
              type="button"
              onClick={() => toggle(item.key)}
              className={cn(
                "min-w-13 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
                toggles[item.key]
                  ? "bg-saffron text-cream border-saffron"
                  : "bg-transparent text-ash border-bone hover:border-ink"
              )}
            >
              {toggles[item.key] ? "On" : "Off"}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4">
        <Button size="md" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save privacy"}
        </Button>
        {saved && <p className="text-sm text-moss">Saved.</p>}
        {error && <p className="text-sm text-ember">{error}</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Notifications section
// ---------------------------------------------------------------------------

const NOTIF_EVENTS = [
  { key: "new_follower", label: "New follower" },
  { key: "direct_messages", label: "Direct messages" },
  { key: "branch_news", label: "Career-Impact news for your branch" },
  { key: "project_invites", label: "Collab Project invites" },
  { key: "weekly_digest", label: "Weekly digest" },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; push: boolean }>>(() =>
    Object.fromEntries(
      NOTIF_EVENTS.map((e) => [e.key, { email: false, push: false }])
    )
  );
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function togglePref(key: string, channel: "email" | "push") {
    setPrefs((prev) => ({
      ...prev,
      [key]: { ...prev[key], [channel]: !prev[key][channel] },
    }));
  }

  function handleSave() {
    const data = new FormData();
    for (const [k, v] of Object.entries(prefs)) {
      data.set(`${k}_email`, String(v.email));
      data.set(`${k}_push`, String(v.push));
    }
    startTransition(async () => {
      const result = await updateNotificationPrefsAction(data);
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    });
  }

  return (
    <section className="rounded-lg border border-bone bg-paper p-6">
      <h2 className="font-serif text-2xl text-ink">Notifications</h2>
      <p className="mt-1 text-sm text-ash">
        Email, push, in-app. Calm by default.
      </p>
      <ul className="mt-6 space-y-4">
        {NOTIF_EVENTS.map((ev) => (
          <li
            key={ev.key}
            className="flex items-center justify-between border-b border-bone pb-4 last:border-0"
          >
            <span className="text-sm text-ink">{ev.label}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => togglePref(ev.key, "email")}
                className={cn(
                  "min-w-13 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
                  prefs[ev.key].email
                    ? "bg-saffron text-cream border-saffron"
                    : "bg-transparent text-ash border-bone hover:border-ink"
                )}
              >
                Email
              </button>
              <button
                type="button"
                onClick={() => togglePref(ev.key, "push")}
                className={cn(
                  "min-w-13 rounded-full px-3 py-1 text-xs font-semibold transition-colors border",
                  prefs[ev.key].push
                    ? "bg-saffron text-cream border-saffron"
                    : "bg-transparent text-ash border-bone hover:border-ink"
                )}
              >
                Push
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center gap-4">
        <Button size="md" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving..." : "Save notifications"}
        </Button>
        {saved && <p className="text-sm text-moss">Saved.</p>}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("account");
  const [signOutPending, startSignOutTransition] = useTransition();
  const [deletePending, startDeleteTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSignOut() {
    startSignOutTransition(async () => {
      await signOutAction();
    });
  }

  function handleDeleteRequest() {
    setConfirmDelete(true);
  }

  function handleDeleteCancel() {
    setConfirmDelete(false);
  }

  function handleDeleteConfirm() {
    setConfirmDelete(false);
    startDeleteTransition(async () => {
      const result = await deleteAccountAction();
      if (result.ok) {
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

      <div className="mt-12 grid gap-10 lg:grid-cols-[240px_1fr]">
        <nav className="flex flex-col gap-1">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                active === s.id
                  ? "bg-ink text-cream"
                  : "text-ink/70 hover:bg-bone"
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
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ash transition-colors hover:bg-bone disabled:opacity-50"
          >
            <LogOut className="size-4" /> {signOutPending ? "Signing out..." : "Sign out"}
          </button>
          <button
            onClick={handleDeleteRequest}
            disabled={deletePending}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-ember transition-colors hover:bg-ember/10 disabled:opacity-50"
          >
            <Trash2 className="size-4" /> {deletePending ? "Deleting..." : "Delete account"}
          </button>
        </nav>

        <Reveal>
          <div className="space-y-8">
            {active === "account" && <AccountSection />}

            {active === "privacy" && <PrivacySection />}

            {active === "notifications" && <NotificationsSection />}

            {active === "dms" && (
              <Reveal>
                <DmPermissionsSection />
              </Reveal>
            )}

            {active === "language" && (
              <section className="rounded-lg border border-bone bg-paper p-6">
                <h2 className="font-serif text-2xl text-ink">Language</h2>
                <p className="mt-1 text-sm text-ash">
                  Coming in v1.1. English only at launch.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {["English", "हिंदी", "ਪੰਜਾਬੀ", "বাংলা"].map((l, i) => (
                    <Button
                      key={l}
                      variant={i === 0 ? "primary" : "secondary"}
                      size="md"
                      disabled={i !== 0}
                    >
                      {l}
                    </Button>
                  ))}
                </div>
              </section>
            )}

            {active === "billing" && (
              <section className="rounded-lg border border-bone bg-paper p-6">
                <h2 className="font-serif text-2xl text-ink">Billing</h2>
                <p className="mt-1 text-sm text-ash">
                  You are on the free plan. Premium activates after the launch
                  cohort.
                </p>
                <div className="mt-6 rounded-lg border border-bone bg-cream p-5">
                  <p className="font-serif text-2xl text-ink">Free plan</p>
                  <p className="mt-1 text-sm text-ash">
                    All core features. Career-Impact engine in preview.
                  </p>
                  <Button className="mt-4" size="md">
                    Upgrade when premium opens
                  </Button>
                </div>
              </section>
            )}
          </div>
        </Reveal>
      </div>

      {/* Delete account confirm overlay */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-bone bg-paper p-6 shadow-lg">
            <h3 className="font-serif text-2xl text-ink">Delete account?</h3>
            <p className="mt-3 text-sm text-ash">
              Your account will be deactivated. You have 14 days to reverse this
              by signing back in. After that, your data is permanently removed.
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
              <Button variant="secondary" size="md" onClick={handleDeleteCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
