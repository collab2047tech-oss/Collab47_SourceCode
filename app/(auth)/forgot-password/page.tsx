"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Password reset is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/auth/callback?next=/reset`,
    });
    setLoading(false);
    // Always show success - do not reveal whether an email exists.
    if (error && !/rate|limit/i.test(error.message)) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
 <main className="min-h-dvh bg-cream">
 <div className="container-edit flex min-h-dvh items-center justify-center py-20">
 <Reveal className="w-full max-w-md">
 <Link href="/" className="font-serif text-3xl font-normal tracking-tight text-ink">
            Collab47.
          </Link>

          {sent ? (
            <>
 <h1 className="mt-12 font-serif text-5xl text-ink">
 Check your <span className="text-saffron">inbox.</span>
              </h1>
 <p className="mt-4 text-body text-ash">
                If an account exists for{" "}
 <span className="text-ink">{email.trim()}</span>, a password
                reset link is on its way. The link expires in one hour.
              </p>
 <p className="mt-3 text-sm text-ash">
                Did not get it? Check spam, or{" "}
                <button
                  type="button"
                  onClick={() => setSent(false)}
 className="text-saffron underline underline-offset-4"
                >
                  try again
                </button>
                .
              </p>
 <p className="mt-8 text-sm text-ash">
 <Link href="/login" className="text-saffron underline underline-offset-4">
                  Back to sign in
                </Link>
              </p>
            </>
          ) : (
            <>
 <h1 className="mt-12 font-serif text-5xl text-ink">
 Forgot your <span className="text-saffron">password?</span>
              </h1>
 <p className="mt-4 text-body text-ash">
                Enter your email and we will send you a link to set a new one.
              </p>

 <form onSubmit={sendReset} className="mt-10 space-y-4">
                <Input
                  label="Email"
                  type="email"
                  name="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
 className="mt-4 w-full justify-center"
                  disabled={loading}
                >
                  {loading ? "Sending…" : "Send reset link"}
 {!loading && <ArrowRight className="size-4" />}
                </Button>
              </form>

              {error ? (
 <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">
                  {error}
                </p>
              ) : null}

 <p className="mt-8 text-center text-sm text-ash">
                Remembered it?{" "}
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
