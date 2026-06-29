import { getSupabaseServer } from "@/lib/supabase/server";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";
import { moderateContent } from "@/lib/moderation/moderate";
import { overLimit, LIMITS, RATE_LIMITED } from "@/lib/security/ratelimit";

interface OkResult { ok: true }
interface ErrResult { ok: false; error: string }
type Result = OkResult | ErrResult;

export type ReactionKind = "like" | "celebrate" | "support" | "love" | "insightful" | "funny";

export async function reactToPost(postId: string, reaction: ReactionKind): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Upsert: insert or update the reaction column on conflict (post_id, user_id).
  const { error } = await sb
    .from("likes")
    .upsert(
      { post_id: postId, user_id: user.id, reaction },
      { onConflict: "post_id,user_id" }
    );
  if (error) return { ok: false, error: error.message };

  // Fire-and-forget notification to the post author (skip if reactor == author).
  void (async () => {
    try {
      const { data: post } = await sb
        .from("posts")
        .select("author_id, short_id")
        .eq("id", postId)
        .maybeSingle();
      if (!post || post.author_id === user.id) return;
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: post.author_id as string,
        kind: "like",
        actorName: actor.name,
        text: `${actor.name} reacted to your post`,
        href: `/p/${post.short_id as string}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function likePost(postId: string): Promise<Result> {
  return reactToPost(postId, "like");
}

export async function unlikePost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("likes").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function addComment(args: {
  postId: string;
  body: string;
  parentCommentId?: string | null;
}): Promise<Result & { commentId?: string }> {
  const body = args.body.trim();
  if (!body) return { ok: false, error: "Comment cannot be empty" };
  if (body.length > 600) return { ok: false, error: "Comment too long (max 600)" };

  const moderationResult = await moderateContent(body);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }

  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (await overLimit(sb, { table: "comments", userColumn: "author_id", userId: user.id, ...LIMITS.comment })) {
    return { ok: false, error: RATE_LIMITED };
  }

  // reject depth > 1
  if (args.parentCommentId) {
    const { data: parent } = await sb
      .from("comments")
      .select("parent_comment_id")
      .eq("id", args.parentCommentId)
      .maybeSingle();
    if (parent?.parent_comment_id) return { ok: false, error: "Only one level of replies allowed" };
  }

  const { data, error } = await sb
    .from("comments")
    .insert({
      post_id: args.postId,
      author_id: user.id,
      parent_comment_id: args.parentCommentId ?? null,
      body,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // Fire-and-forget notifications: notify the post author about the comment and,
  // for a reply, also notify the parent comment's author.
  void (async () => {
    try {
      const { data: post } = await sb
        .from("posts")
        .select("author_id, short_id")
        .eq("id", args.postId)
        .maybeSingle();
      if (!post) return;
      const shortId = post.short_id as string;
      const postAuthorId = post.author_id as string;

      // Resolve the parent comment's author (if this is a reply).
      let parentAuthorId: string | null = null;
      if (args.parentCommentId) {
        const { data: parent } = await sb
          .from("comments")
          .select("author_id")
          .eq("id", args.parentCommentId)
          .maybeSingle();
        parentAuthorId = (parent?.author_id as string | undefined) ?? null;
      }

      // We only need the actor's display info if there's at least one recipient.
      const needsActor =
        (postAuthorId && postAuthorId !== user.id) ||
        (parentAuthorId && parentAuthorId !== user.id);
      if (!needsActor) return;
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;

      // Notify the post author (skip if commenter is the author).
      if (postAuthorId && postAuthorId !== user.id) {
        await createNotification({
          userId: postAuthorId,
          kind: "comment",
          actorName: actor.name,
          text: `${actor.name} commented on your post`,
          href: `/p/${shortId}`,
        });
      }

      // Notify the parent comment's author about the reply (skip self, and skip
      // if they're the post author who was already notified above).
      if (
        parentAuthorId &&
        parentAuthorId !== user.id &&
        parentAuthorId !== postAuthorId
      ) {
        await createNotification({
          userId: parentAuthorId,
          kind: "comment_reply",
          actorName: actor.name,
          text: `${actor.name} replied to your comment`,
          href: `/p/${shortId}`,
        });
      }
    } catch { /* best-effort */ }
  })();

  return { ok: true, commentId: data.id as string };
}

export async function deleteComment(commentId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  // Author-only delete. RLS also enforces this, but we check explicitly so a
  // non-author gets a clear error instead of a silent no-op (0 rows affected).
  const { data: comment } = await sb
    .from("comments")
    .select("author_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { ok: false, error: "Comment not found" };
  if ((comment.author_id as string) !== user.id) {
    return { ok: false, error: "You can only delete your own comment." };
  }

  const { error } = await sb.from("comments").delete().eq("id", commentId).eq("author_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function repostPost(args: {
  originalPostId: string;
  addedBody?: string;
}): Promise<Result & { postId?: string; shortId?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  if (await overLimit(sb, { table: "posts", userColumn: "author_id", userId: user.id, ...LIMITS.post })) {
    return { ok: false, error: RATE_LIMITED };
  }

  const { data: original } = await sb
    .from("posts")
    .select("hashtags, branch_tags, city_tags, author_id, short_id, deleted_at, expires_at")
    .eq("id", args.originalPostId)
    .maybeSingle();
  if (!original) return { ok: false, error: "Original post not found" };

  // Reject reposts of originals that are no longer live (soft-deleted or expired).
  const originalDeleted = (original.deleted_at as string | null) !== null;
  const originalExpired =
    original.expires_at !== null && new Date(original.expires_at as string) < new Date();
  if (originalDeleted || originalExpired) {
    return { ok: false, error: "This post is no longer available." };
  }

  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const body = (args.addedBody ?? "").slice(0, 2000);

  const { data, error } = await sb
    .from("posts")
    .insert({
      author_id: user.id,
      body,
      is_repost: true,
      reposted_from_post_id: args.originalPostId,
      hashtags: original.hashtags ?? [],
      branch_tags: original.branch_tags ?? [],
      city_tags: original.city_tags ?? [],
      expires_at,
    })
    .select("id, short_id")
    .single();
  if (error) return { ok: false, error: error.message };

  // repost_count is maintained by a DB trigger. Notify the original author.
  const originalAuthor = original.author_id as string;
  if (originalAuthor && originalAuthor !== user.id) {
    void (async () => {
      try {
        const actor = await getActorDisplayInfo(user.id);
        if (!actor) return;
        await createNotification({
          userId: originalAuthor,
          kind: "repost",
          actorName: actor.name,
          text: `${actor.name} reposted your post`,
          href: `/p/${original.short_id as string}`,
        });
      } catch { /* best-effort */ }
    })();
  }

  return { ok: true, postId: data.id as string, shortId: data.short_id as string };
}

export async function removeRepost(repostPostId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { error } = await sb.from("posts").delete().eq("id", repostPostId).eq("is_repost", true);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function bookmarkPost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  if (await overLimit(sb, { table: "bookmarks", userColumn: "user_id", userId: user.id, ...LIMITS.bookmark })) {
    return { ok: false, error: RATE_LIMITED };
  }
  const { error } = await sb.from("bookmarks").insert({ post_id: postId, user_id: user.id });
  if (error && !error.message.includes("duplicate")) return { ok: false, error: error.message };

  // Fire-and-forget notification to the post author (skip if saver == author).
  void (async () => {
    try {
      const { data: post } = await sb
        .from("posts")
        .select("author_id, short_id")
        .eq("id", postId)
        .maybeSingle();
      if (!post || post.author_id === user.id) return;
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: post.author_id as string,
        kind: "bookmark",
        actorName: actor.name,
        text: `${actor.name} saved your post`,
        href: `/p/${post.short_id as string}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function unbookmarkPost(postId: string): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("bookmarks").delete().eq("post_id", postId).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMyEngagementState(postIds: string[]) {
  const sb = await getSupabaseServer();
  if (!sb || postIds.length === 0) {
    return {
      likes: new Set<string>(),
      bookmarks: new Set<string>(),
      reactions: new Map<string, string>(),
    };
  }
  const { data: { user } } = await sb.auth.getUser();
  if (!user) {
    return {
      likes: new Set<string>(),
      bookmarks: new Set<string>(),
      reactions: new Map<string, string>(),
    };
  }

  const [{ data: likeRows }, { data: bookmarks }] = await Promise.all([
    sb.from("likes").select("post_id, reaction").eq("user_id", user.id).in("post_id", postIds),
    sb.from("bookmarks").select("post_id").eq("user_id", user.id).in("post_id", postIds),
  ]);

  const reactions = new Map<string, string>();
  for (const r of likeRows ?? []) {
    reactions.set(r.post_id as string, (r.reaction as string) ?? "like");
  }

  return {
    likes: new Set((likeRows ?? []).map((r) => r.post_id as string)),
    bookmarks: new Set((bookmarks ?? []).map((r) => r.post_id as string)),
    reactions,
  };
}
