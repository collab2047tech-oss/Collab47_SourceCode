import { PublicTopNav as Nav } from "@/components/layout/PublicTopNav";
import { Footer } from "@/components/landing/Footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Collab47",
  description:
    "How Collab47 collects, uses and protects your data, and your rights under India's Digital Personal Data Protection Act, 2023.",
};

const updated = "20 June 2026";

export default function PrivacyPage() {
  return (
 <main className="min-h-screen bg-cream text-ink">
      <Nav />

 <section className="section pt-32 sm:pt-40 md:pt-48">
 <div className="container-edit max-w-3xl">
 <p className="text-caption rule-top inline-block">Legal</p>
 <h1 className="mt-8 text-[2.5rem] leading-[1.16] tracking-tight font-serif text-ink sm:mt-10 sm:text-display-md">
            Privacy Policy
          </h1>
 <p className="mt-6 text-body text-ash">Last updated {updated}.</p>

 <div className="prose-legal mt-14 space-y-10 text-body text-ink/85">
            <p>
              Collab47 is India&apos;s unified academia-industry collaboration
              ecosystem, operated by Collab47 Technologies Private Limited, India
              (&ldquo;Collab47&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). This
              policy explains what we collect, why, and the control you have over
              it. We keep it short and we keep it honest.
            </p>

            <div>
 <h2 className="font-serif text-3xl text-ink">What we collect</h2>
 <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  <strong>Account data</strong> you give us: name, email, handle,
                  your institution or organisation, field, interests, and
                  anything you add to your profile.
                </li>
                <li>
                  <strong>Content you create</strong>: posts, comments,
                  reactions, messages, projects, and uploaded media.
                </li>
                <li>
                  <strong>Usage data</strong> needed to run the product: what you
                  view and engage with, so the feed can be relevant. We do not
                  build advertising profiles.
                </li>
              </ul>
            </div>

            <div>
 <h2 className="font-serif text-3xl text-ink">How we use it</h2>
 <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>To run your account and show you a relevant feed.</li>
                <li>To connect you with people and projects in your field.</li>
                <li>To keep the platform safe (moderation, abuse prevention).</li>
                <li>To fix bugs and improve the product.</li>
              </ul>
 <p className="mt-4">
                We do not sell your data. We do not run ads. We do not share your
                personal data with third parties except the infrastructure
                providers below, who process it strictly to run the service.
              </p>
            </div>

            <div>
 <h2 className="font-serif text-3xl text-ink">Where it lives</h2>
 <p className="mt-4">
                Your data is stored with Supabase (Postgres database, file
                storage and authentication) hosted in the Mumbai
                (ap-south-1) region in India. We do not yet send transactional
                email; if we add it, we will name the provider here. These
                providers process data only to deliver the service.
              </p>
            </div>

 <div id="dpdp" className="scroll-mt-32">
 <h2 className="font-serif text-3xl text-ink">
                Your rights (DPDP Act, 2023)
              </h2>
 <p className="mt-4">
                Under India&apos;s Digital Personal Data Protection Act, 2023, you
                can:
              </p>
 <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Access the personal data we hold about you.</li>
                <li>Correct or update inaccurate data - most of it from your settings.</li>
                <li>
                  Delete your account and your personal data (we remove it,
                  except where law requires us to retain a record).
                </li>
                <li>Withdraw consent you previously gave.</li>
              </ul>
 <p className="mt-4">
                To exercise any of these, email{" "}
                <a
                  href="mailto:collab2047.tech@gmail.com"
 className="text-saffron underline underline-offset-4"
                >
                  collab2047.tech@gmail.com
                </a>
                . We respond within a reasonable time.
              </p>
            </div>

            <div>
 <h2 className="font-serif text-3xl text-ink">Children</h2>
 <p className="mt-4">
                Collab47 is intended for users aged 16 and above. It is not
                intended for anyone under 16. If you believe a younger child has
                registered, contact us and we will remove the account.
              </p>
            </div>

            <div>
 <h2 className="font-serif text-3xl text-ink">Changes</h2>
 <p className="mt-4">
                The product is evolving. If this policy changes materially, we
                will update the date above and, where it matters, tell you in the
                app.
              </p>
            </div>

            <div>
 <h2 className="font-serif text-3xl text-ink">Contact</h2>
 <p className="mt-4">
                Questions about your privacy? Write to{" "}
                <a
                  href="mailto:collab2047.tech@gmail.com"
 className="text-saffron underline underline-offset-4"
                >
                  collab2047.tech@gmail.com
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
