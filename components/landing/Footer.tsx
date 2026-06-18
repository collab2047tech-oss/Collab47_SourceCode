import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-ink py-20 text-cream">
      <div className="container-edit">
        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
          <div>
            <p className="font-serif text-3xl">Collab47.</p>
            <p className="mt-4 text-sm text-cream/60">
              India's first work-first network for students.
            </p>
          </div>
          <div>
            <p className="text-caption text-cream/60">Product</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="/home" className="hover:text-saffron">Feed</Link></li>
              <li><Link href="/explore" className="hover:text-saffron">Explore</Link></li>
              <li><Link href="/network" className="hover:text-saffron">Network</Link></li>
              <li><Link href="/profile" className="hover:text-saffron">Profile</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-caption text-cream/60">Company</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="#" className="hover:text-saffron">Careers</Link></li>
              <li><Link href="#" className="hover:text-saffron">Contact</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-caption text-cream/60">Legal</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link href="#" className="hover:text-saffron">Privacy</Link></li>
              <li><Link href="#" className="hover:text-saffron">Terms</Link></li>
              <li><Link href="#" className="hover:text-saffron">DPDP compliance</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-cream/15 pt-8 text-caption text-cream/50">
          <p>Collab47 Technologies, Amritsar, India. 2026.</p>
          <p className="font-indic">सहयोग. कौशल. भविष्य.</p>
        </div>
      </div>
    </footer>
  );
}
