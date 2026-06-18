import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { CountUp } from "@/components/motion/CountUp";
import { ProfileTabs } from "@/components/composite/ProfileTabs";
import { getMyProfile } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { MapPin, GraduationCap, Pencil } from "lucide-react";
import type { PostWithAuthor } from "@/lib/db/posts";

const HIGHLIGHTS = ["Hackathons", "Projects", "Talks", "Press", "Awards"];

const MOCK_PROFILE = {
  id: "mock",
  name: "Akshpreet Singh",
  handle: "akshpreet",
  bio: "CEO and Co-founder, Collab47. Building India's work-first network for students.",
  college: "Punjabi University",
  branch: "CSE",
  year_of_study: "26",
  city: "Amritsar",
  avatar_url: null as string | null,
  verified: true,
};

const MOCK_STATS = {
  connections: 142,
  posts: 28,
  projects: 5,
  score: 89,
};

export default async function ProfilePage() {
  const profile = await getMyProfile();

  let posts: PostWithAuthor[] = [];
  let stats = MOCK_STATS;

  if (profile) {
    posts = await getProfilePosts(profile.id, 24);
    stats = {
      connections: 142,
      posts: posts.length,
      projects: 5,
      score: 89,
    };
  }

  const p = profile ?? MOCK_PROFILE;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Cover */}
      <Reveal>
        <div className="-mx-4 h-48 bg-[linear-gradient(135deg,#1F3A2C_0%,#0A0A0B_100%)] md:-mx-8 md:h-64" />
      </Reveal>

      {/* Header */}
      <Reveal delay={0.1}>
        <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-start gap-4">
            <Avatar
              name={p.name}
              src={p.avatar_url ?? undefined}
              size="2xl"
              className="ring-4 ring-cream"
            />
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="font-serif text-4xl text-ink md:text-5xl">
                  {p.name}
                </h1>
                {p.verified ? <Tag variant="saffron">Verified</Tag> : null}
              </div>
              {p.bio ? (
                <p className="mt-2 text-body text-ash">{p.bio}</p>
              ) : null}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ash">
                {p.college ? (
                  <span className="flex items-center gap-1.5">
                    <GraduationCap className="size-4" /> {p.college}
                    {p.branch ? ` . ${p.branch}` : ""}
                    {p.year_of_study ? ` '${p.year_of_study}` : ""}
                  </span>
                ) : null}
                {p.city ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" /> {p.city}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/profile/edit">
              <Button variant="secondary" size="md">
                <Pencil className="size-4" /> Edit profile
              </Button>
            </Link>
            <Button size="md">Share</Button>
          </div>
        </div>
      </Reveal>

      {/* Stats */}
      <Reveal delay={0.15}>
        <div className="mt-10 grid grid-cols-4 gap-4 border-y border-bone py-6">
          {[
            { label: "Connections", value: stats.connections },
            { label: "Posts", value: stats.posts },
            { label: "Projects", value: stats.projects },
            { label: "Score", value: stats.score, suffix: "%" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-serif text-3xl text-ink">
                <CountUp to={s.value} />
                {s.suffix ?? ""}
              </div>
              <p className="mt-1 text-caption">{s.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* Highlights */}
      <Reveal delay={0.2}>
        <div className="mt-10">
          <p className="text-caption mb-4">Highlights</p>
          <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar">
            {HIGHLIGHTS.map((h) => (
              <div
                key={h}
                className="flex shrink-0 flex-col items-center gap-2"
              >
                <div className="size-20 rounded-full border border-bone bg-paper p-1">
                  <div className="size-full rounded-full bg-[linear-gradient(135deg,#2C5BFF_0%,#0B1220_100%)]" />
                </div>
                <p className="text-xs text-ink">{h}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      {/* Tabs + content (client island) */}
      <ProfileTabs posts={posts} />
    </div>
  );
}
