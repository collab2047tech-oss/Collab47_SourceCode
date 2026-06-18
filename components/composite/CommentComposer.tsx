"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/primitives/Avatar";
import { Send } from "lucide-react";
import { addCommentAction } from "@/app/(app)/home/engagement-actions";

interface Props {
  postId: string;
  parentCommentId?: string | null;
  currentUserName?: string;
  onPosted?: () => void;
}

export function CommentComposer({ postId, parentCommentId, currentUserName = "You", onPosted }: Props) {
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setError(null);
    const fd = new FormData();
    fd.set("postId", postId);
    fd.set("body", text);
    if (parentCommentId) fd.set("parentCommentId", parentCommentId);
    start(async () => {
      const res = await addCommentAction(fd);
      if (res.ok) {
        setBody("");
        onPosted?.();
      } else if ("error" in res) {
        setError(res.error ?? "Could not post comment.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-3 py-3">
      <Avatar name={currentUserName} size="sm" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 600))}
            rows={1}
            placeholder={parentCommentId ? "Reply" : "Add a comment"}
            className="min-h-9 flex-1 resize-none rounded-md border border-bone bg-cream px-3 py-2 text-sm text-ink placeholder:text-ash focus:border-ink focus:outline-none"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-saffron px-4 text-sm text-cream transition-colors hover:bg-saffron-dk disabled:opacity-50"
          >
            <Send className="size-3.5" />
            {pending ? "..." : "Send"}
          </button>
        </div>
        <div className="flex items-center justify-between">
          {error ? <span className="text-xs text-ember">{error}</span> : <span />}
          <span className="text-caption">{body.length}/600</span>
        </div>
      </div>
    </form>
  );
}
