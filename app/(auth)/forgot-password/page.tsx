"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
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
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <Reveal className="mx-auto w-full max-w-md">
            <Link href="/" className="inline-block">
              <Wordmark size="md" />
            </Link>

            {sent ? (
              <>
                <h1 className="mt-10 font-serif text-4xl text-ink sm:text-5xl">
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
                <h1 className="mt-10 font-serif text-4xl text-ink sm:text-5xl">
                  Forgot your <span className="text-saffron">password?</span>
                </h1>
                <p className="mt-4 text-body text-ash">
                  Enter your email and we will send you a link to set a new one.
                </p>

                <form onSubmit={sendReset} className="mt-8 space-y-4">
                  <Input
                    label="Email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    autoFocus
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="focus-visible:border-saffron focus-visible:ring-2 focus-visible:ring-saffron/30"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    className="mt-4 w-full justify-center"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : (<>Send reset link <ArrowRight className="size-4" /></>)}
                  </Button>
                </form>

                <div aria-live="polite">
                  {error ? (
                    <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">
                      {error}
                    </p>
                  ) : null}
                </div>

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

        <BrandPanel />
      </div>
    </main>
  );
}
