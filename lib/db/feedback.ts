import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { sendFeedbackAlert } from "@/lib/email/notify";

export type FeedbackKind = "bug" | "feature" | "other";
export type FeedbackStatus = "open" | "in_progress" | "resolved" | "wont_fix";

export interface FeedbackRow {
  id: string;
  user_id: string | null;
  kind: FeedbackKind;
  subject: string;
  body: string;
  page_url: string | null;
  user_agent: string | null;
  status: FeedbackStatus;
  admin_note: string | null;
  created_at: string;
  resolved_at: string | null;
  author?: { name: string; handle: string; avatar_url: string | null } | null;
}

type Result = { ok: true } | { ok: false; error: string };

const clamp = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");

/** Submit a bug report / feature request / note. Signed-in users only. */
export async function submitFeedback(input: {
  kind: FeedbackKind;
  subject: string;
  body: string;
  page_url?: string;
  user_agent?: string;
}): Promise<Result> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Not available right now." };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in to send feedback." };

  const kind: FeedbackKind = ["bug", "feature", "other"].includes(input.kind) ? input.kind : "bug";
  const subject = clamp(input.subject, 160);
  const body = clamp(input.body, 4000);
  if (!subject) return { ok: false, error: "Add a short subject." };
  if (body.length < 4) return { ok: false, error: "Tell us a bit more." };

  const { error } = await sb.from("feedback").insert({
    user_id: user.id,
    kind,
    subject,
    body,
    page_url: clamp(input.page_url, 300) || null,
    user_agent: clamp(input.user_agent, 400) || null,
  });
  if (error) return { ok: false, error: error.message };

  // Fire-and-forget: alert the admin team so a report never sits unseen. Never
  // blocks or fails the user's submission.
  void sendFeedbackAlert({
    kind,
    subject,
    body,
    pageUrl: clamp(input.page_url, 300) || null,
    reporterEmail: user.email ?? null,
  });
  return { ok: true };
}

/** Admin: list all feedback (newest first), optionally filtered by status. */
export async function listFeedback(status?: FeedbackStatus): Promise<FeedbackRow[]> {
  if (!(await isCurrentUserAdmin())) return [];
  const admin = getAdminClient();
  if (!admin) return [];
  let q = admin
    .from("feedback")
    .select("*, author:profiles!feedback_user_id_fkey(name,handle,avatar_url)")
    .order("created_at", { ascending: false })
    .limit(500);
  if (status) q = q.eq("status", status);
  const { data } = await q;
  return (data as FeedbackRow[] | null) ?? [];
}

/** Admin: triage a feedback item. */
export async function setFeedbackStatus(id: string, status: FeedbackStatus, note?: string): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: "Not authorized." };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Not available." };
  const patch: Record<string, unknown> = { status };
  if (typeof note === "string") patch.admin_note = clamp(note, 2000) || null;
  patch.resolved_at = status === "resolved" || status === "wont_fix" ? new Date().toISOString() : null;
  const { error } = await admin.from("feedback").update(patch).eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** Counts by status for the admin badge. */
export async function feedbackCounts(): Promise<{ open: number; total: number }> {
  if (!(await isCurrentUserAdmin())) return { open: 0, total: 0 };
  const admin = getAdminClient();
  if (!admin) return { open: 0, total: 0 };
  const [{ count: open }, { count: total }] = await Promise.all([
    admin.from("feedback").select("id", { count: "exact", head: true }).eq("status", "open"),
    admin.from("feedback").select("id", { count: "exact", head: true }),
  ]);
  return { open: open ?? 0, total: total ?? 0 };
}
