import { Avatar } from "@/components/primitives/Avatar";
import { getSupabaseServer } from "@/lib/supabase/server";
import { CommentComposer } from "./CommentComposer";

interface CommentWithAuthor {
  id: string;
  body: string;
  created_at: string;
  parent_comment_id: string | null;
  author: { handle: string; name: string; avatar_url: string | null };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

const MOCK_COMMENTS: CommentWithAuthor[] = [
  {
    id: "c1",
    body: "Wait, you built this in 9 days? Drop the repo.",
    created_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    parent_comment_id: null,
    author: { handle: "riya", name: "Riya Sharma", avatar_url: null },
  },
  {
    id: "c2",
    body: "Coming up tomorrow. Sharing in the discord first.",
    created_at: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    parent_comment_id: "c1",
    author: { handle: "vikram", name: "Vikram Singh", avatar_url: null },
  },
  {
    id: "c3",
    body: "Same boat. Building my own SaaS now. Let me know if you want a co-founder.",
    created_at: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    parent_comment_id: null,
    author: { handle: "arjun", name: "Arjun Mehta", avatar_url: null },
  },
];

export async function CommentThread({ postId }: { postId: string }) {
  const sb = await getSupabaseServer();
  let comments: CommentWithAuthor[] = MOCK_COMMENTS;
  if (sb) {
    const { data } = await sb
      .from("comments")
      .select("id, body, created_at, parent_comment_id, author:profiles!comments_author_id_fkey(handle,name,avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true })
      .limit(100);
    if (data) comments = data as unknown as CommentWithAuthor[];
  }

  const tops = comments.filter((c) => !c.parent_comment_id);
  const replies = new Map<string, CommentWithAuthor[]>();
  for (const c of comments) {
    if (c.parent_comment_id) {
      const arr = replies.get(c.parent_comment_id) ?? [];
      arr.push(c);
      replies.set(c.parent_comment_id, arr);
    }
  }

  return (
    <section className="mt-4 border-t border-bone pt-2">
      <ul className="divide-y divide-bone">
        {tops.length === 0 ? (
          <li className="py-4 text-center text-xs text-ash">No comments yet.</li>
        ) : (
          tops.map((c) => (
            <li key={c.id} className="py-3">
              <article className="flex items-start gap-3">
                <Avatar name={c.author.name} src={c.author.avatar_url ?? undefined} size="sm" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-ink">{c.author.name}</span>
                    <span className="text-xs text-ash">@{c.author.handle} . {relativeTime(c.created_at)}</span>
                  </div>
                  <p className="mt-1 text-sm text-ink">{c.body}</p>
                </div>
              </article>

              {replies.get(c.id)?.length ? (
                <ul className="ml-8 mt-2 space-y-2 border-l border-bone pl-4">
                  {replies.get(c.id)!.map((r) => (
                    <li key={r.id}>
                      <article className="flex items-start gap-2">
                        <Avatar name={r.author.name} src={r.author.avatar_url ?? undefined} size="xs" />
                        <div className="flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold text-ink">{r.author.name}</span>
                            <span className="text-xs text-ash">{relativeTime(r.created_at)}</span>
                          </div>
                          <p className="mt-0.5 text-xs text-ink">{r.body}</p>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))
        )}
      </ul>

      <CommentComposer postId={postId} />
    </section>
  );
}
