import type { PostWithAuthor } from "@/lib/db/posts";
import type { Post as CardPost } from "@/components/composite/PostCard";
import { getMyEngagementState } from "@/lib/db/engagement";
import { toCardPost } from "@/lib/ui/toCardPost";

type EngState = Awaited<ReturnType<typeof getMyEngagementState>>;

/** Map one DB post to a CardPost and overlay the viewer's engagement state. */
export function withEng(p: PostWithAuthor, eng: EngState): CardPost {
  const card = toCardPost(p);
  card.liked = eng.likes.has(p.id);
  card.saved = eng.bookmarks.has(p.id);
  card.reaction = eng.reactions.get(p.id);
  return card;
}

/** Batch: fetch the viewer's engagement for a set of posts and map them all. */
export async function toCardsWithEng(posts: PostWithAuthor[]): Promise<CardPost[]> {
  const ids = posts.map((p) => p.id);
  const eng = await getMyEngagementState(ids);
  return posts.map((p) => withEng(p, eng));
}
