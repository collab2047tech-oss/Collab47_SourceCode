"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { GOOGLE_AUTH_ENABLED, PHONE_AUTH_ENABLED } from "@/app/(auth)/authProviders";
import { isValidEmailFormat } from "@/lib/security/email-validate";
import { signUpAction } from "@/app/(auth)/signup/actions";
import { Wordmark } from "@/components/brand/Wordmark";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Prefill email when arriving from the landing CTA (/signup?email=...).
  useEffect(() => {
    const qp = new URLSearchParams(window.location.search).get("email");
    if (qp) setEmail(qp);
  }, []);

  function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Fast client-side hints only - the AUTHORITATIVE gate (format + disposable
    // + MX + signUp) lives in signUpAction on the server and cannot be skipped.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!isValidEmailFormat(email.trim())) {
      setError("That email does not look valid. Check for typos.");
      return;
    }
    startTransition(async () => {
      const result = await signUpAction({ email: email.trim(), password });
      if (!result.ok) {
        setError(result.error ?? "Could not create your account. Try again.");
        return;
      }
      // signUpAction set the session cookie server-side; go to onboarding.
      location.href = "/onboarding";
    });
  }

  async function signInGoogle() {
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Sign up is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/onboarding` },
    });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Sign up is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
    const { error } = await sb.auth.signInWithOtp({ phone: formatted });
    if (error) setError(error.message);
    else setStep("otp");
    setLoading(false);
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Sign up is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
    const { error } = await sb.auth.verifyOtp({ phone: formatted, token: otp, type: "sms" });
    if (error) setError(error.message);
    else location.href = "/onboarding";
    setLoading(false);
  }

  return (
 <main className="min-h-dvh bg-cream">
 <div className="container-edit flex min-h-dvh items-center justify-center py-20">
 <Reveal className="w-full max-w-md">
 <Link href="/" className="font-serif text-3xl font-normal tracking-tight text-ink">
            <Wordmark />
          </Link>
 <p className="text-caption mt-12">Sign up</p>
 <h1 className="mt-4 font-serif text-5xl text-ink">
 Show what you <span className="text-saffron">actually do.</span>
          </h1>
 <p className="mt-4 text-body text-ash">
            For students, researchers, faculty, institutions and industry.
          </p>

 <form onSubmit={signUpEmail} className="mt-10 space-y-4">
            <Input
              label="Email"
              type="email"
              name="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
 <Button type="submit" size="lg" className="mt-4 w-full justify-center" disabled={loading || pending}>
 Create account <ArrowRight className="size-4" />
            </Button>
          </form>

 <div className="my-8 flex items-center gap-4">
 <span className="h-px flex-1 bg-bone" />
 <span className="text-caption">or</span>
 <span className="h-px flex-1 bg-bone" />
          </div>

 <div className="space-y-3">
            {GOOGLE_AUTH_ENABLED ? (
              <Button
                variant="secondary"
                size="lg"
 className="w-full justify-center"
                onClick={signInGoogle}
                disabled={loading}
              >
                Continue with Google
              </Button>
            ) : (
              <button
                type="button"
                disabled
                title="Google sign-up is coming soon. Use email for now."
                aria-label="Continue with Google - coming soon"
 className="flex h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg border border-ink/10 bg-transparent px-7 text-lg font-medium text-ash opacity-60"
              >
                Continue with Google
 <span className="rounded-full bg-bone px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-ash">
                  Coming soon
                </span>
              </button>
            )}
          </div>

          {PHONE_AUTH_ENABLED ? (
            <>
 <div className="my-8 flex items-center gap-4">
 <span className="h-px flex-1 bg-bone" />
 <span className="text-caption">or phone</span>
 <span className="h-px flex-1 bg-bone" />
              </div>

              {step === "phone" ? (
 <form onSubmit={sendOtp} className="space-y-4">
                  <Input
                    label="Phone (India)"
                    type="tel"
                    name="phone"
                    placeholder="+91 98000 00000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
 <Button type="submit" size="lg" className="mt-4 w-full justify-center" disabled={loading}>
 Send OTP <ArrowRight className="size-4" />
                  </Button>
                </form>
              ) : (
 <form onSubmit={verifyOtp} className="space-y-4">
                  <Input
                    label="6-digit code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    name="otp"
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
 <Button type="submit" size="lg" className="mt-4 w-full justify-center" disabled={loading}>
 Verify <ArrowRight className="size-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => setStep("phone")}
 className="block w-full text-center text-sm text-ash underline"
                  >
                    Change phone
                  </button>
                </form>
              )}
            </>
          ) : null}

          {error ? (
 <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p>
          ) : null}

 <p className="mt-8 text-center text-sm text-ash">
            Already in?{" "}
 <Link href="/login" className="text-saffron underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </Reveal>
      </div>
    </main>
  );
}
