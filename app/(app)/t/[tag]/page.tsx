import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getMyEngagementState } from "@/lib/db/engagement";
import { toCardPost } from "@/lib/ui/toCardPost";
import { PostCard } from "@/components/composite/PostCard";
import type { PostWithAuthor } from "@/lib/db/posts";
import { Hash } from "lucide-react";

export const dynamic = "force-dynamic";

const SELECT =
  "*, author:profiles!posts_author_id_fkey(handle,name,avatar_url,college,verified)";

export default async function HashtagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag: raw } = await params;
  const tag = decodeURIComponent(raw).toLowerCase().replace(/^#/, "");

  const sb = await getSupabaseServer();
  let posts: PostWithAuthor[] = [];
  let myId = "";
  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    myId = user?.id ?? "";
    const { data } = await sb
      .from("posts")
      .select(SELECT)
      .contains("hashtags", [tag])
      .is("deleted_at", null)
      .or("expires_at.is.null,expires_at.gt.now()")
      .order("created_at", { ascending: false })
      .limit(40);
    posts = (data as PostWithAuthor[]) ?? [];
  }

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
      <p className="mt-2 text-sm text-ash">{posts.length} post{posts.length === 1 ? "" : "s"}</p>

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
