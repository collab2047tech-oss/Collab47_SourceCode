import { getSupabaseServer } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "@/lib/supabase/env";

export type ReportCategory = "spam" | "hate" | "sexual" | "other";

interface SubmitArgs {
  targetType: "post" | "profile";
  targetId: string;
  category: ReportCategory;
  body?: string;
}

export async function submitReport(args: SubmitArgs): Promise<{ ok: boolean; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  const row: Record<string, unknown> = {
    reporter_id: user.id,
    category: args.category,
    body: args.body?.slice(0, 300) ?? null,
  };
  if (args.targetType === "post") row.post_id = args.targetId;
  else row.profile_id = args.targetId;

  const { error } = await sb.from("reports").insert(row);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export interface QueueItem {
  id: string;
  category: ReportCategory;
  report_body: string | null;
  reported_at: string;
  reporter_handle: string | null;
  post_id: string | null;
  profile_id: string | null;
  post_body: string | null;
  target_handle: string | null;
  report_total: number;
}

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MOCK_QUEUE: QueueItem[] = [
  {
    id: "r1", category: "spam",
    report_body: "buy followers spam",
    reported_at: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    reporter_handle: "riya",
    post_id: "p1", profile_id: null,
    post_body: "Get 1000 followers for 99 rupees. Click here to win an iPhone.",
    target_handle: "scammer42",
    report_total: 3,
  },
  {
    id: "r2", category: "hate",
    report_body: null,
    reported_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    reporter_handle: "arjun",
    post_id: "p2", profile_id: null,
    post_body: "Sample reported content.",
    target_handle: "anonymous_user",
    report_total: 2,
  },
];

export async function getModerationQueue(limit = 50): Promise<QueueItem[]> {
  const sc = serviceClient();
  if (!sc) return MOCK_QUEUE;
  const { data } = await sc.from("moderation_queue").select("*").limit(limit);
  return (data as QueueItem[]) ?? [];
}

export async function resolveReport(
  reportId: string,
  action: "dismiss" | "remove_post" | "suspend_user"
): Promise<{ ok: boolean; error?: string }> {
  const sc = serviceClient();
  if (!sc) return { ok: true };

  if (action === "dismiss") {
    const { error } = await sc.from("reports").update({ resolved_at: new Date().toISOString() }).eq("id", reportId);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const { data: report, error: fetchErr } = await sc
    .from("reports").select("post_id, profile_id").eq("id", reportId).maybeSingle();
  if (fetchErr || !report) return { ok: false, error: fetchErr?.message ?? "Not found" };

  if (action === "remove_post" && report.post_id) {
    await sc.from("posts").update({ deleted_at: new Date().toISOString() }).eq("id", report.post_id);
  } else if (action === "suspend_user") {
    const targetId = report.profile_id ?? (await sc.from("posts").select("author_id").eq("id", report.post_id!).single()).data?.author_id;
    if (targetId) await sc.from("profiles").update({ suspended_at: new Date().toISOString() }).eq("id", targetId);
  }

  await sc.from("reports").update({ resolved_at: new Date().toISOString() }).eq("id", reportId);
  return { ok: true };
}
