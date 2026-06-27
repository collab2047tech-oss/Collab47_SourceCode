import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use — Collab47",
  description:
    "The rules for using Collab47 — your account, your content, acceptable use, and the terms of service.",
};

const updated = "20 June 2026";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-cream text-ink">
      <Nav />

      <section className="section pt-32 sm:pt-40 md:pt-48">
        <div className="container-edit max-w-3xl">
          <p className="text-caption rule-top inline-block">Legal</p>
          <h1 className="mt-8 text-[2.5rem] leading-[1.08] tracking-tight font-serif text-ink sm:mt-10 sm:text-display-md">
            Terms of Use
          </h1>
          <p className="mt-6 text-body text-ash">Last updated {updated}.</p>

          <div className="mt-14 space-y-10 text-body text-ink/85">
            <p>
              These terms govern your use of Collab47, operated by Collab47
              Technologies Private Limited, India. By creating an account, you
              agree to them. If you do not agree, please do not use the service.
            </p>

            <div>
              <h2 className="font-serif text-3xl text-ink">Your account</h2>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>You must be at least 16 years old to join.</li>
                <li>Give accurate information and keep your login secure.</li>
                <li>You are responsible for activity on your account.</li>
              </ul>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Your content</h2>
              <p className="mt-4">
                You own what you create. By posting, you grant Collab47 a licence
                to host and display your content so the product can function —
                show it in feeds, profiles and search. You can delete your
                content at any time, which ends that licence going forward.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Acceptable use</h2>
              <p className="mt-4">Do not use Collab47 to:</p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Harass, threaten, dox or impersonate anyone.</li>
                <li>Post hateful, sexual, violent or illegal content.</li>
                <li>Spam, scam, or run schemes against other users.</li>
                <li>Scrape, attack, or interfere with the platform.</li>
              </ul>
              <p className="mt-4">
                We moderate content and may remove anything that breaks these
                rules, and suspend or remove accounts that do.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Service availability</h2>
              <p className="mt-4">
                The product is evolving. Features may change, break, or
                disappear, and the service is provided &ldquo;as is&rdquo; without
                warranties. We work hard to keep it running and safe, but we
                cannot guarantee uninterrupted or error-free service.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Liability</h2>
              <p className="mt-4">
                To the extent permitted by law, Collab47 is not liable for
                indirect or consequential losses arising from use of the service.
                Nothing here limits liability that cannot be limited under Indian
                law.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Governing law</h2>
              <p className="mt-4">
                These terms are governed by the laws of India, and disputes are
                subject to the courts of India.
              </p>
            </div>

            <div>
              <h2 className="font-serif text-3xl text-ink">Contact</h2>
              <p className="mt-4">
                Questions about these terms? Write to{" "}
                <a
                  href="mailto:collab2047.tech@gmail.com"
                  className="text-saffron underline underline-offset-4"
                >
                  collab2047.tech@gmail.com
                </a>
                . See also our{" "}
                <a
                  href="/privacy"
                  className="text-saffron underline underline-offset-4"
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
