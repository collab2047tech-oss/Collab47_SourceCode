"use client";

import { Reveal } from "@/components/motion/Reveal";
import { Input } from "@/components/primitives/Input";
import { Button } from "@/components/primitives/Button";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInGoogle() {
    setError(null);
    setLoading(true);
    const sb = getSupabaseBrowser();
    if (!sb) {
      setError("Sign in is not configured yet on this build. Try the deployed version.");
      setLoading(false);
      return;
    }
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/home` },
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
      setError("Sign in is not configured yet on this build.");
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
      setError("Sign in is not configured yet on this build.");
      setLoading(false);
      return;
    }
    const formatted = phone.startsWith("+") ? phone : `+91${phone.replace(/\D/g, "")}`;
    const { error } = await sb.auth.verifyOtp({ phone: formatted, token: otp, type: "sms" });
    if (error) setError(error.message);
    else location.href = "/home";
    setLoading(false);
  }

  return (
    <main className="min-h-dvh bg-cream">
      <div className="container-edit flex min-h-dvh items-center justify-center py-20">
        <Reveal className="w-full max-w-md">
          <Link href="/" className="font-serif text-3xl font-normal tracking-tight text-ink">
            Collab47.
          </Link>
          <h1 className="mt-12 font-serif text-5xl text-ink">
            Welcome <span className="italic text-saffron">back.</span>
          </h1>
          <p className="mt-4 text-body text-ash">
            Sign in to your portfolio. Pick up where you left off.
          </p>

          <div className="mt-10 space-y-3">
            <Button
              variant="secondary"
              size="lg"
              className="w-full justify-center"
              onClick={signInGoogle}
              disabled={loading}
            >
              Continue with Google
            </Button>
          </div>

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

          {error ? (
            <p className="mt-4 rounded-md bg-ember/10 px-3 py-2 text-sm text-ember">{error}</p>
          ) : null}

          <p className="mt-8 text-center text-sm text-ash">
            New here?{" "}
            <Link href="/signup" className="text-saffron underline underline-offset-4">
              Create an account
            </Link>
          </p>
        </Reveal>
      </div>
    </main>
  );
}
