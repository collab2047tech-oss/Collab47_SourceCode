import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, escapeHtml } from "./send";
import { emailShell } from "./render";
import { unsubToken } from "./token";

const BASE = "https://collab47.com";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface DigestContent {
  newFollowers: number;
  followerNames: string[];
  pendingRequests: number;
  topPosts: Array<{ author: string; snippet: string; url: string; likes: number }>;
  community: Array<{ name: string; handle: string }>;
  hasMeaning: boolean;
}

/** Build a single user's digest from real activity in the trailing window. */
async function buildDigest(
  admin: any,
  userId: string,
  clusterId: number | null,
  sinceIso: string,
): Promise<DigestContent> {
  // New followers in-window (+ a few names).
  const { data: fr } = await admin
    .from("follows")
    .select("follower_id, created_at")
    .eq("following_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(20);
  const followerIds = (fr ?? []).map((r: any) => r.follower_id as string);
  let followerNames: string[] = [];
  if (followerIds.length > 0) {
    const { data: fp } = await admin
      .from("profiles")
      .select("name")
      .in("id", followerIds.slice(0, 5));
    followerNames = (fp ?? []).map((p: any) => p.name as string).filter(Boolean);
  }

  // Pending incoming connection requests (user is a party, but not the requester).
  const { count: pendingRequests } = await admin
    .from("connections")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .neq("requested_by", userId)
    .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`);

  // Top posts in-window from people this user follows.
  const { data: follows } = await admin
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId)
    .limit(1000);
  const followingIds = (follows ?? []).map((f: any) => f.following_id as string);
  let topPosts: DigestContent["topPosts"] = [];
  if (followingIds.length > 0) {
    const { data: posts } = await admin
      .from("posts")
      .select("short_id, body, like_count, author:profiles!posts_author_id_fkey(name)")
      .in("author_id", followingIds)
      .is("deleted_at", null)
      .gte("created_at", sinceIso)
      .order("like_count", { ascending: false })
      .limit(3);
    topPosts = (posts ?? []).map((p: any) => ({
      author: p.author?.name ?? "Someone",
      snippet: (p.body as string).slice(0, 120),
      url: `${BASE}/p/${p.short_id}`,
      likes: p.like_count ?? 0,
    }));
  }

  // A few people from the same community (Louvain cluster).
  let community: DigestContent["community"] = [];
  if (clusterId !== null && clusterId !== undefined) {
    const { data: cp } = await admin
      .from("profiles")
      .select("name, handle")
      .eq("cluster_id", clusterId)
      .neq("id", userId)
      .is("deleted_at", null)
      .is("suspended_at", null)
      .limit(3);
    community = (cp ?? []).map((p: any) => ({ name: p.name as string, handle: p.handle as string }));
  }

  const nf = followerIds.length;
  const pr = pendingRequests ?? 0;
  return {
    newFollowers: nf,
    followerNames,
    pendingRequests: pr,
    topPosts,
    community,
    hasMeaning: nf > 0 || pr > 0 || topPosts.length > 0,
  };
}

function renderDigest(name: string, c: DigestContent, unsubUrl: string): string {
  const first = escapeHtml((name || "").split(" ")[0] || "there");
  const parts: string[] = [];

  if (c.newFollowers > 0) {
    const names = c.followerNames.map(escapeHtml).slice(0, 3).join(", ");
    const extra = c.newFollowers > 3 ? ` and ${c.newFollowers - 3} more` : "";
    parts.push(
      `<p style="margin:0 0 14px"><strong style="color:#0A0F1C">${c.newFollowers} new follower${c.newFollowers === 1 ? "" : "s"}</strong>${names ? ` - ${names}${extra}` : ""}.</p>`,
    );
  }
  if (c.pendingRequests > 0) {
    parts.push(
      `<p style="margin:0 0 14px"><strong style="color:#0A0F1C">${c.pendingRequests} connection request${c.pendingRequests === 1 ? "" : "s"}</strong> waiting for you.</p>`,
    );
  }
  if (c.topPosts.length > 0) {
    const items = c.topPosts
      .map(
        (p) =>
          `<li style="margin-bottom:10px"><a href="${p.url}" style="color:#2C5BFF;text-decoration:none;font-weight:600">${escapeHtml(p.author)}</a>: ${escapeHtml(p.snippet)}${p.snippet.length >= 120 ? "..." : ""}</li>`,
      )
      .join("");
    parts.push(
      `<p style="margin:0 0 6px;color:#0A0F1C;font-weight:600">Worth a look from your network</p><ul style="margin:0 0 14px;padding-left:18px;color:#42506B">${items}</ul>`,
    );
  }
  if (c.community.length > 0) {
    const people = c.community
      .map(
        (p) =>
          `<a href="${BASE}/u/${p.handle}" style="color:#2C5BFF;text-decoration:none;font-weight:600">${escapeHtml(p.name)}</a>`,
      )
      .join(", ");
    parts.push(`<p style="margin:0 0 4px;color:#8A93A6;font-size:13px">People in your community: ${people}</p>`);
  }

  return emailShell({
    title: `Your week on Collab47, ${first}`,
    intro: "Here is what moved while you were away.",
    bodyHtml: parts.join(""),
    cta: { text: "Open Collab47", href: `${BASE}/home` },
    footerNote: `You get this weekly summary as a Collab47 member. <a href="${unsubUrl}" style="color:#8A93A6">Unsubscribe</a>.`,
  });
}

/**
 * Build and send the weekly digest to every eligible member (onboarded, not
 * opted out, has an email, and has something worth summarising). Returns counts.
 * Fire-and-forget per user: one failure never aborts the batch.
 */
export async function runWeeklyDigest(): Promise<{ processed: number; sent: number }> {
  const admin = getAdminClient();
  if (!admin) return { processed: 0, sent: 0 };

  const sinceIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, name, cluster_id")
    .eq("onboarded", true)
    .eq("digest_opt_out", false)
    .is("deleted_at", null)
    .is("suspended_at", null)
    .limit(5000);
  if (!profiles || profiles.length === 0) return { processed: 0, sent: 0 };

  // Map user id -> email from the auth schema (paginated).
  const emailById = new Map<string, string>();
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const u of data.users) if (u.email) emailById.set(u.id, u.email);
    if (data.users.length < 1000) break;
  }

  let processed = 0;
  let sent = 0;
  for (const p of profiles as any[]) {
    const email = emailById.get(p.id as string);
    if (!email) continue;
    processed++;
    try {
      const content = await buildDigest(admin, p.id, p.cluster_id ?? null, sinceIso);
      if (!content.hasMeaning) continue;
      const unsubUrl = `${BASE}/api/unsubscribe?u=${p.id}&t=${unsubToken(p.id)}`;
      await sendEmail({
        to: email,
        subject: "Your week on Collab47",
        html: renderDigest(p.name as string, content, unsubUrl),
      });
      sent++;
    } catch (e) {
      console.error("[digest] user failed", p.id, e);
    }
  }
  return { processed, sent };
}
