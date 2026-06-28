import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getMyEngagementState } from "@/lib/db/engagement";
import { toCardPost } from "@/lib/ui/toCardPost";
import { PostCard } from "@/components/composite/PostCard";
import { Tag } from "@/components/primitives/Tag";
import { attachReposts, type PostWithAuthor } from "@/lib/db/posts";
import { expandTags } from "@/lib/ranker/taxonomy";
import { cn } from "@/lib/cn";
import { Hash } from "lucide-react";

export const dynamic = "force-dynamic";

// Repost originals resolved via attachReposts() (PostgREST can't self-embed posts).
const SELECT =
  "*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college,verified)";

type Sort = "top" | "latest";

// Engagement score for the "Top" sort (weighted reactions, with a recency nudge
// so a fresh-but-strong post can beat an old one). Kept local to this page.
function topScore(p: PostWithAuthor): number {
  const eng = p.like_count + 2 * p.comment_count + 3 * p.repost_count + p.bookmark_count;
  const ageHours = Math.max((Date.now() - new Date(p.created_at).getTime()) / 3.6e6, 0);
  const recency = Math.exp(-ageHours / 72); // 3-day half-life-ish
  return eng + recency;
}

export default async function HashtagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ sort?: string }>;
}) {
  const { tag: raw } = await params;
  const { sort: sortRaw } = await searchParams;
  const tag = decodeURIComponent(raw).toLowerCase().replace(/^#/, "");
  const sort: Sort = sortRaw === "top" ? "top" : "latest";

  const sb = await getSupabaseServer();
  let posts: PostWithAuthor[] = [];
  let myId = "";
  let totalCount = 0;
  let authorCount = 0;

  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    myId = user?.id ?? "";

    const [postsRes, tagRes] = await Promise.all([
      sb
        .from("posts")
        .select(SELECT)
        .contains("hashtags", [tag])
        .is("deleted_at", null)
        .or("expires_at.is.null,expires_at.gt.now()")
        .order("created_at", { ascending: false })
        .limit(60),
      // Real total from the now-maintained hashtags table.
      sb.from("hashtags").select("use_count").eq("tag", tag).maybeSingle(),
    ]);

    posts = await attachReposts(sb, (postsRes.data as unknown as PostWithAuthor[]) ?? []);
    totalCount = (tagRes.data?.use_count as number | undefined) ?? posts.length;
    authorCount = new Set(posts.map((p) => p.author_id)).size;
  }

  if (sort === "top") {
    posts = [...posts].sort((a, b) => topScore(b) - topScore(a));
  }

  // Related tags from the taxonomy graph ("you might also like"), minus self.
  const related = [...expandTags([tag]).keys()].filter((t) => t !== tag).slice(0, 8);

  const eng = await getMyEngagementState(posts.map((p) => p.id));
  const cards = posts.map((p) => {
    const c = toCardPost(p);
    c.liked = eng.likes.has(p.id);
    c.saved = eng.bookmarks.has(p.id);
    c.reaction = eng.reactions.get(p.id);
    return c;
  });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rule-top flex items-center gap-2">
        <Hash className="size-6 text-saffron" />
        <h1 className="font-serif text-4xl text-ink">{tag}</h1>
      </div>

      {/* Stats strip: real total + contributors (honest, not the page cap). */}
      <p className="mt-2 text-sm text-ash tabular-nums">
        {totalCount} {totalCount === 1 ? "post" : "posts"}
        {authorCount > 0 ? ` · ${authorCount} ${authorCount === 1 ? "contributor" : "contributors"}` : ""}
      </p>

      {/* Top / Latest toggle (Instagram/X parity). High-contrast segmented. */}
      <div className="mt-5 inline-flex rounded-full border border-bone bg-paper p-1">
        {(["top", "latest"] as const).map((s) => (
          <Link
            key={s}
            href={`/t/${tag}${s === "top" ? "?sort=top" : ""}`}
            scroll={false}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              sort === s ? "bg-ink text-cream" : "text-ash hover:text-ink"
            )}
          >
            {s}
          </Link>
        ))}
      </div>

      {/* Related tags */}
      {related.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {related.map((t) => (
            <Link key={t} href={`/t/${t}`} className="transition-opacity hover:opacity-80">
              <Tag variant="outline">#{t}</Tag>
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-8">
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-bone bg-paper/50 py-16 text-center">
            <p className="text-sm text-ash">No posts with #{tag} yet.</p>
          </div>
        ) : (
          cards.map((p) => <PostCard key={p.id} post={p} currentUserId={myId} />)
        )}
      </div>
    </div>
  );
}
