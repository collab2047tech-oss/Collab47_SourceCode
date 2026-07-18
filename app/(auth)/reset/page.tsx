"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { Wordmark } from "@/components/brand/Wordmark";

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
 <div className="container-edit flex min-h-dvh items-center justify-center py-20">
 <Reveal className="w-full max-w-md">
 <Link href="/" className="font-serif text-3xl font-normal tracking-tight text-ink">
            <Wordmark />
          </Link>

          {done ? (
            <>
 <h1 className="mt-12 font-serif text-5xl text-ink">
 Password <span className="text-saffron">updated.</span>
              </h1>
 <p className="mt-4 text-body text-ash">Signing you in…</p>
            </>
          ) : (
            <>
 <h1 className="mt-12 font-serif text-5xl text-ink">
 Set a new <span className="text-saffron">password.</span>
              </h1>
 <p className="mt-4 text-body text-ash">
                Choose a password you will remember this time.
              </p>

 <form onSubmit={updatePassword} className="mt-10 space-y-4">
                <Input
                  label="New password"
                  type="password"
                  name="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!ready}
                  required
                />
                <Input
                  label="Confirm password"
                  type="password"
                  name="confirm"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  disabled={!ready}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
 className="mt-4 w-full justify-center"
                  disabled={loading || !ready}
                >
                  {loading ? "Saving…" : "Update password"}
 {!loading && <ArrowRight className="size-4" />}
                </Button>
              </form>

              {error ? (
 <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">
                  {error}{" "}
 <Link href="/forgot-password" className="underline underline-offset-4">
                    Request a new link
                  </Link>
                </p>
              ) : null}

 <p className="mt-8 text-center text-sm text-ash">
 <Link href="/login" className="text-saffron underline underline-offset-4">
                  Back to sign in
                </Link>
              </p>
            </>
          )}
        </Reveal>
      </div>
    </main>
  );
}
