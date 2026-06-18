import Link from "next/link";
import { Avatar } from "@/components/primitives/Avatar";
import { Button } from "@/components/primitives/Button";
import { Tag } from "@/components/primitives/Tag";
import { Reveal } from "@/components/motion/Reveal";
import { Nav } from "@/components/landing/Nav";
import { MapPin, GraduationCap } from "lucide-react";
import { getProfileByHandle } from "@/lib/db/profiles";
import { getProfilePosts } from "@/lib/db/posts";
import { getFollowState } from "@/lib/db/social";
import { ProfileActions } from "@/components/composite/ProfileActions";

export default async function PublicProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getProfileByHandle(handle);

  if (!profile) {
    // mock-data fallback for dev when Supabase isn't configured
    return (
      <main className="min-h-dvh bg-cream">
        <Nav />
        <div className="container-edit pt-40">
          <p className="text-caption">@{handle}</p>
          <h1 className="mt-4 font-serif text-5xl text-ink">
            Profile <span className="italic text-saffron">not found.</span>
          </h1>
          <p className="mt-4 text-body text-ash">
            This handle is either available or the user has not signed up yet.
          </p>
          <Link href="/signup" className="mt-8 inline-block">
            <Button size="lg">Claim this handle</Button>
          </Link>
        </div>
      </main>
    );
  }

  const [posts, followState] = await Promise.all([
    getProfilePosts(profile.id, 12),
    getFollowState(profile.id),
  ]);

  return (
    <main className="min-h-dvh bg-cream">
      <Nav />
      <div className="container-edit pt-32 pb-20">
        <Reveal>
          <div className="-mx-4 h-40 bg-[linear-gradient(135deg,#0B1220_0%,#0A0F1C_100%)] md:-mx-8 md:h-56" />
        </Reveal>

        <Reveal delay={0.1}>
          <div className="-mt-16 flex flex-col gap-6 md:-mt-20 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-col items-start gap-4">
              <Avatar name={profile.name} src={profile.avatar_url ?? undefined} size="2xl" className="ring-4 ring-cream" />
              <div>
                <div className="flex flex-wrap items-baseline gap-3">
                  <h1 className="font-serif text-4xl text-ink md:text-5xl">{profile.name}</h1>
                  {profile.verified ? <Tag variant="saffron">Verified</Tag> : null}
                </div>
                <p className="mt-1 text-sm text-ash">@{profile.handle}</p>
                {profile.bio ? <p className="mt-3 max-w-xl text-body text-ink">{profile.bio}</p> : null}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ash">
                  {profile.college ? (
                    <span className="flex items-center gap-1.5">
                      <GraduationCap className="size-4" /> {profile.college}
                      {profile.branch ? ` . ${profile.branch}` : ""}
                      {profile.year_of_study ? ` '${profile.year_of_study}` : ""}
                    </span>
                  ) : null}
                  {profile.city ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-4" /> {profile.city}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <ProfileActions
              handle={profile.handle}
              targetUserId={profile.id}
              initialState={{ isFollowing: followState.isFollowing }}
            />
          </div>
        </Reveal>

        <Reveal delay={0.2}>
          <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-3">
            {posts.length === 0 ? (
              <p className="col-span-full text-center text-ash">No posts yet.</p>
            ) : (
              posts.map((p) => (
                <Link
                  key={p.id}
                  href={`/p/${p.short_id}`}
                  className="group aspect-square overflow-hidden rounded-lg bg-paper border border-bone p-5 transition-all hover:border-saffron"
                >
                  <p className="line-clamp-6 text-sm text-ink">{p.body}</p>
                </Link>
              ))
            )}
          </div>
        </Reveal>
      </div>
    </main>
  );
}
