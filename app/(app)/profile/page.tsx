import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { CountUp } from "@/components/motion/CountUp";
import { ProfileTabs } from "@/components/composite/ProfileTabs";
import { getMyProfile } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getMyConnections } from "@/lib/db/social";
import { getSupabaseServer } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { MapPin, GraduationCap, Pencil, CheckCircle2 } from "lucide-react";
import { ShareButton } from "@/components/composite/ShareButton";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/onboarding");

  const [posts, connections] = await Promise.all([
    getProfilePosts(profile.id, 24),
    getMyConnections("all"),
  ]);

  // Real project count + the user's own projects (for the Projects tab).
  let projectCount = 0;
  let myProjects: import("@/components/composite/ProfileTabs").ProfileProject[] = [];
  const sb = await getSupabaseServer();
  if (sb) {
    const { count } = await sb
      .from("project_members")
      .select("project_id", { count: "exact", head: true })
      .eq("user_id", profile.id);
    projectCount = count ?? 0;

    const { data: projRows } = await sb
      .from("projects")
      .select("id, short_id, title, brief, status, slot_count")
      .eq("author_id", profile.id)
      .order("created_at", { ascending: false });
    myProjects = (projRows as typeof myProjects) ?? [];
  }

  // Profile completeness as a lightweight "score".
  const fields = [profile.name, profile.bio, profile.college, profile.branch, profile.city, profile.avatar_url];
  const score = Math.round((fields.filter(Boolean).length / fields.length) * 100);

  const stats = {
    connections: connections.length,
    posts: posts.length,
    projects: projectCount,
    score,
  };

  const p = profile;

  return (
    <div className="min-h-dvh bg-cream">
      {/* ------------------------------------------------------------------ */}
      {/* COVER BAND - full-width, no container constraint                    */}
      {/* ------------------------------------------------------------------ */}
      <Reveal y={0}>
        <div
          className="relative w-full overflow-hidden"
          style={{ height: "260px" }}
        >
          {/* Gradient cover */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #0B1220 0%, #1a2744 40%, #2C5BFF22 70%, #0B1220 100%)",
            }}
          />
          {/* Subtle noise texture overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
          />
          {/* Cobalt accent glow - top right */}
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-20"
            style={{
              background:
                "radial-gradient(ellipse at 80% 20%, #2C5BFF 0%, transparent 60%)",
            }}
          />
        </div>
      </Reveal>

      {/* ------------------------------------------------------------------ */}
      {/* PROFILE HEADER - avatar overlaps cover                             */}
      {/* ------------------------------------------------------------------ */}
      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <Reveal delay={0.05}>
          <div className="-mt-20 flex flex-col gap-6 md:-mt-24 md:flex-row md:items-end md:justify-between">
            {/* LEFT: avatar + identity */}
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:gap-6">
              {/* Avatar with gradient ring (story-bubble effect) */}
              <div
                className="relative shrink-0 rounded-full p-0.75"
                style={{
                  background:
                    "linear-gradient(135deg, #2C5BFF 0%, #5a7dff 50%, #2C5BFF 100%)",
                  boxShadow: "0 0 0 3px #F5F7FB",
                }}
              >
                <Avatar
                  name={p.name}
                  src={p.avatar_url ?? undefined}
                  size="2xl"
                  className="ring-0"
                />
              </div>

              {/* Name + verified + headline */}
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1
                    className="font-serif text-4xl leading-tight tracking-tight text-ink md:text-5xl"
                    style={{ letterSpacing: "-0.02em" }}
                  >
                    {p.name}
                  </h1>
                  {p.verified ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                      style={{
                        background: "rgba(44,91,255,0.10)",
                        color: "#2C5BFF",
                      }}
                    >
                      <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                      Verified
                    </span>
                  ) : null}
                </div>

                {/* Headline: college · branch */}
                {(p.college || p.branch || p.city) ? (
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-ash">
                    {p.college ? (
                      <span className="flex items-center gap-1">
                        <GraduationCap className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {p.college}
                        {p.branch ? (
                          <span className="text-bone">
                            &nbsp;·&nbsp;
                            <span className="text-ash">{p.branch}</span>
                          </span>
                        ) : null}
                        {p.year_of_study ? (
                          <span className="text-bone">
                            &nbsp;&middot;&nbsp;
                            <span className="text-ash">&apos;{p.year_of_study}</span>
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                    {p.city ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3.5 shrink-0" strokeWidth={1.75} />
                        {p.city}
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {/* Bio teaser under headline */}
                {p.bio ? (
                  <p className="mt-3 max-w-lg text-sm leading-relaxed text-ash">
                    {p.bio}
                  </p>
                ) : null}
              </div>
            </div>

            {/* RIGHT: action buttons */}
            <div className="flex shrink-0 items-center gap-3">
              <Link href="/profile/edit">
                <Button variant="secondary" size="md" className="gap-2">
                  <Pencil className="size-4" strokeWidth={1.75} />
                  Edit profile
                </Button>
              </Link>
              <ShareButton path={`/u/${p.handle}`} label="Share" />
            </div>
          </div>
        </Reveal>

        {/* ---------------------------------------------------------------- */}
        {/* STATS STRIP                                                       */}
        {/* ---------------------------------------------------------------- */}
        <Reveal delay={0.12}>
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-bone bg-bone sm:grid-cols-4">
            {[
              { label: "Connections", value: stats.connections },
              { label: "Posts", value: stats.posts },
              { label: "Projects", value: stats.projects },
              { label: "Profile score", value: stats.score, suffix: "%" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex flex-col items-center justify-center bg-paper px-4 py-5 text-center transition-colors hover:bg-cream"
              >
                <div
                  className="font-serif text-3xl font-normal text-ink"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  <CountUp to={s.value} />
                  {s.suffix ?? ""}
                </div>
                <p className="mt-1 text-caption tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>

        {/* ---------------------------------------------------------------- */}
        {/* TABS + CONTENT                                                   */}
        {/* ---------------------------------------------------------------- */}
        <ProfileTabs
          posts={posts}
          projects={myProjects}
          bio={p.bio}
          college={p.college}
          branch={p.branch}
        />
      </div>

      {/* bottom breathing room */}
      <div className="h-16 md:h-24" />
    </div>
  );
}
