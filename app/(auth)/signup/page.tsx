"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useTransition } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { GOOGLE_AUTH_ENABLED, PHONE_AUTH_ENABLED } from "@/app/(auth)/authProviders";
import { isValidEmailFormat } from "@/lib/security/email-validate";
import { signUpAction } from "@/app/(auth)/signup/actions";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/cn";

// Password field with a show/hide toggle. Local to this file so we control the
// relative wrapper + absolutely-positioned toggle; the shared Input primitive
// cannot host an overlaid control. Accepts an optional invalid state + hint.
function PasswordField({
  id,
  label,
  name,
  autoComplete,
  value,
  onChange,
  onBlur,
  placeholder,
  invalid,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  invalid?: boolean;
  hint?: React.ReactNode;
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
          onBlur={onBlur}
          required
          aria-invalid={invalid || undefined}
          className={cn(
            "h-12 w-full rounded-md border bg-paper pl-4 pr-14 text-base text-ink placeholder:text-ash transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron/30",
            invalid
              ? "border-ember focus:border-ember focus-visible:border-ember"
              : "border-ink/15 focus:border-saffron focus-visible:border-saffron"
          )}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-pressed={show}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-ash transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/40"
        >
          {show ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>
      {hint}
    </div>
  );
}

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
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

  // Inline confirm-password mismatch (shown once the field has been blurred).
  const mismatch = confirmTouched && confirm.length > 0 && confirm !== password;
  // Honest, length-only password guidance - no entropy/strength claims.
  const passwordHint =
    password.length === 0
      ? null
      : password.length < 8
        ? `${8 - password.length} more character${8 - password.length === 1 ? "" : "s"} to reach the 8-character minimum.`
        : password.length < 12
          ? "Good - meets the 8-character minimum."
          : "Nice and long.";
  const canSubmit = password.length >= 8 && confirm === password;

  function signUpEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Fast client-side hints only - the AUTHORITATIVE gate (format + disposable
    // + MX + signUp) lives in signUpAction on the server and cannot be skipped.
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setConfirmTouched(true);
      setError("Passwords do not match.");
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
      <div className="grid min-h-dvh lg:grid-cols-2">
        {/* Form column */}
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14">
          <Reveal className="mx-auto w-full max-w-md">
            <Link href="/" className="inline-block">
              <Wordmark size="md" />
            </Link>
            <p className="text-caption mt-10">Sign up</p>
            <h1 className="mt-4 font-serif text-4xl text-ink sm:text-5xl">
              Show what you <span className="text-saffron">actually do.</span>
            </h1>
            <p className="mt-4 text-body text-ash">
              For students, researchers, faculty, institutions and industry.
            </p>

            <form onSubmit={signUpEmail} className="mt-8 space-y-4">
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
              <PasswordField
                id="signup-password"
                label="Password"
                name="password"
                autoComplete="new-password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={
                  passwordHint ? (
                    <p className="text-xs text-ash" aria-live="polite">
                      {passwordHint}
                    </p>
                  ) : null
                }
              />
              <PasswordField
                id="signup-confirm"
                label="Confirm password"
                name="confirm"
                autoComplete="new-password"
                placeholder="Re-enter password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => setConfirmTouched(true)}
                invalid={mismatch}
                hint={
                  mismatch ? (
                    <p className="text-xs text-ember" aria-live="polite">
                      Passwords do not match.
                    </p>
                  ) : null
                }
              />
              <Button
                type="submit"
                size="lg"
                className="mt-4 w-full justify-center"
                disabled={loading || pending || !canSubmit}
              >
                {pending ? "Creating account..." : (<>Create account <ArrowRight className="size-4" /></>)}
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
                  <span className="rounded-full bg-bone px-2 py-0.5 text-caption font-medium text-ash">
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
                      autoComplete="tel"
                      placeholder="+91 98000 00000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="focus-visible:border-saffron focus-visible:ring-2 focus-visible:ring-saffron/30"
                    />
                    <Button type="submit" size="lg" className="mt-4 w-full justify-center" disabled={loading}>
                      {loading ? "Sending..." : (<>Send OTP <ArrowRight className="size-4" /></>)}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={verifyOtp} className="space-y-4">
                    <Input
                      label="6-digit code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      name="otp"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                      className="focus-visible:border-saffron focus-visible:ring-2 focus-visible:ring-saffron/30"
                    />
                    <Button type="submit" size="lg" className="mt-4 w-full justify-center" disabled={loading}>
                      {loading ? "Verifying..." : (<>Verify <ArrowRight className="size-4" /></>)}
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

            <div aria-live="polite">
              {error ? (
                <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p>
              ) : null}
            </div>

            <p className="mt-8 text-center text-sm text-ash">
              Already in?{" "}
              <Link href="/login" className="text-saffron underline underline-offset-4">
                Sign in
              </Link>
            </p>
          </Reveal>
        </div>

        {/* Brand panel (desktop only) - typography only, cream on navy. Every
            line traces to the deck; no invented imagery or stats. */}
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
              Where talent, innovation and opportunity converge. Connect talent,
              solve real problems, build India.
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
      </div>
    </main>
  );
}
