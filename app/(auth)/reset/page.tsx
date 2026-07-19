"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/cn";

// Shared brand panel (desktop only) - typography only, cream on navy. Every line
// traces to the deck; no invented imagery or stats.
function BrandPanel() {
  return (
    <aside
      className={cn(
        "relative hidden flex-col justify-between overflow-hidden bg-navy px-12 py-14 text-cream",
        "lg:flex xl:px-16 xl:py-16"
      )}
    >
      <div>
        <Wordmark markOnly size="md" />
      </div>
      <div className="max-w-md">
        <h2 className="font-serif text-4xl leading-[1.16] text-cream xl:text-5xl">
          Connect. Create. Succeed.
        </h2>
        <p className="mt-6 text-body-lg leading-relaxed text-cream/75">
          Where talent, innovation and opportunity converge. One platform,
          infinite collaborations.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="font-serif text-lg text-cream/90">
          Collaborate &amp; Innovate for Viksit Bharat 2047.
        </p>
        <p className="text-caption text-cream/50">
          Collab47 Technologies Private Limited
        </p>
      </div>
    </aside>
  );
}

// Password field with a show/hide toggle. Local to this file so we control the
// relative wrapper + absolutely-positioned toggle.
function PasswordField({
  id,
  label,
  name,
  autoComplete,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="text-caption text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required
          className="h-12 w-full rounded-md border border-ink/15 bg-paper pl-4 pr-14 text-base text-ink placeholder:text-ash transition-colors focus:border-saffron focus:outline-none focus-visible:border-saffron focus-visible:ring-2 focus-visible:ring-saffron/30 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          disabled={disabled}
          className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 disabled:opacity-50"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);

  // The /auth/callback exchanged the recovery code for a session before
  // redirecting here. Confirm a session exists; if not, the link was bad/expired.
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Password reset is not configured yet on this build.");
      return;
    }
    sb.auth.getUser().then(({ data }) => {
      if (data.user) setReady(true);
      else
        setError(
          "This reset link is invalid or has expired. Request a new one.",
        );
    });
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Password reset is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const { error } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      location.href = "/home";
    }, 1200);
  }

  return (
    <main className="min-h-dvh bg-cream">
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <Reveal className="mx-auto w-full max-w-md">
            <Link href="/" className="inline-block">
              <Wordmark size="md" />
            </Link>

            {done ? (
              <>
                <h1 className="mt-10 font-serif text-4xl text-ink sm:text-5xl">
                  Password <span className="text-saffron">updated.</span>
                </h1>
                <p className="mt-4 text-body text-ash">Signing you in...</p>
              </>
            ) : (
              <>
                <h1 className="mt-10 font-serif text-4xl text-ink sm:text-5xl">
                  Set a new <span className="text-saffron">password.</span>
                </h1>
                <p className="mt-4 text-body text-ash">
                  Choose a password you will remember this time.
                </p>

                <form onSubmit={updatePassword} className="mt-8 space-y-4">
                  <PasswordField
                    id="reset-password"
                    label="New password"
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!ready}
                  />
                  <PasswordField
                    id="reset-confirm"
                    label="Confirm password"
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={!ready}
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="mt-4 w-full justify-center"
                    disabled={loading || !ready}
                  >
                    {loading ? "Saving..." : (<>Update password <ArrowRight className="size-4" /></>)}
                  </Button>
                </form>

                <div aria-live="polite">
                  {error ? (
                    <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">
                      {error}{" "}
                      <Link href="/forgot-password" className="underline underline-offset-4">
                        Request a new link
                      </Link>
                    </p>
                  ) : null}
                </div>

                <p className="mt-8 text-center text-sm text-ash">
                  <Link href="/login" className="text-saffron underline underline-offset-4">
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </Reveal>
        </div>

        <BrandPanel />
      </div>
    </main>
  );
}
