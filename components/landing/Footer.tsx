import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";

const COLUMNS: { heading: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "Home", href: "/" },
      { label: "About", href: "/about" },
      { label: "Manifesto", href: "/manifesto" },
      { label: "Sign up", href: "/signup" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Contact", href: "mailto:collab2047.tech@gmail.com", external: true },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "DPDP compliance", href: "/privacy#dpdp" },
    ],
  },
];

export function Footer() {
  return (
 <footer className="bg-ink py-16 text-cream md:py-20">
 <div className="container-edit">
 <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-2 md:grid-cols-4 md:gap-12">
 <div className="col-span-2 md:col-span-1">
 <p className="font-serif text-3xl"><Wordmark /></p>
 <p className="mt-4 max-w-xs text-sm text-cream/60">
              India&apos;s unified academia-industry collaboration ecosystem.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
 <p className="text-caption uppercase tracking-wide text-cream/50">{col.heading}</p>
 <ul className="mt-4 space-y-2.5 text-sm">
                {col.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a
                        href={l.href}
 className="inline-block text-cream/85 transition-colors hover:text-saffron"
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <Link
                        href={l.href}
 className="inline-block text-cream/85 transition-colors hover:text-saffron"
                      >
                        {l.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

 <div className="mt-14 flex flex-col gap-3 border-t border-cream/15 pt-8 text-caption text-cream/50 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <p>© 2026 Collab47 Technologies Private Limited. India.</p>
          <p>Connect. Create. Succeed.</p>
        </div>
      </div>
    </footer>
  );
}
