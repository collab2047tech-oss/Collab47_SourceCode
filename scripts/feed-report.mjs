// ===========================================================================
// Feed-matching validation harness. Replicates getForYouFeed's recall + the
// EXACT scorePost/diversifyTopK (ported verbatim from lib/ranker/score.ts) for
// a chosen viewer, then prints the ranked feed with per-signal reasons and a
// quantified "does matching actually discriminate?" metric.
//
// Run:  node scripts/feed-report.mjs <handle>     (default: t_rohan_3)
// ===========================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")
    .filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const SELECT = "*, author:profiles!posts_author_id_fkey(handle,name,verified,branch)";
const lc = (s) => (s || "").toLowerCase();
const ageHours = (iso) => Math.max((Date.now() - new Date(iso).getTime()) / 3.6e6, 0);

// --- scorePost ported verbatim from lib/ranker/score.ts -------------------
const W = { match: 0.4, recency: 0.2, engagement: 0.15, authorTrust: 0.1, diversity: 0.1, safety: 0.3 };
function scorePost(post, ctx) {
  const reason = [];
  const interestSet = new Set(ctx.interests.map(lc));
  const tagOverlap = (post.hashtags ?? []).filter((h) => interestSet.has(lc(h))).length;
  const branchMatch = ctx.branch && (post.branch_tags ?? []).some((b) => lc(b) === lc(ctx.branch)) ? 1 : 0;
  const rel = ctx.relevancy.get(post.id) ?? 0;
  const cf = ctx.cf.get(post.id) ?? 0;
  const match = Math.min(0.3 + tagOverlap * 0.18 + branchMatch * 0.25 + rel * 0.3 + cf * 0.25, 1);
  if (tagOverlap > 0) reason.push(`interest×${tagOverlap}`);
  if (branchMatch) reason.push(`branch:${ctx.branch}`);
  if (rel > 0) reason.push("BM25");
  if (cf > 0.01) reason.push(`cf:${cf.toFixed(2)}`);
  const recency = Math.exp(-ageHours(post.created_at) / 24);
  const impressions = post.impressions ?? 30;
  const engagement = (post.like_count + 2 * post.comment_count + 4 * post.bookmark_count + 8 * post.repost_count) / (impressions + 10);
  const verified = post.author?.verified ? 1 : 0;
  const ppr = ctx.ppr.get(post.author_id) ?? 0;
  if (ppr >= 1) reason.push("follows");
  else if (ppr > 0) reason.push("2nd-deg");
  const authorTrust = Math.min(0.35 + verified * 0.4 + ppr * 0.25, 1);
  const primary = (post.hashtags ?? [])[0]?.toLowerCase();
  const diversity = primary && ctx.recentTags.includes(primary) ? 0.3 : 1;
  const criteria = [[W.match, match], [W.recency, recency], [W.engagement, Math.min(engagement, 1)], [W.authorTrust, authorTrust], [W.diversity, diversity], [W.safety, 1]];
  const tcheby = 1 - Math.max(...criteria.map(([w, f]) => w * Math.abs(1 - f)));
  return { post, score: tcheby, reason, _match: match, _rel: rel, _cf: cf, _ppr: ppr, tagOverlap, branchMatch };
}

async function main() {
  const handle = process.argv[2] || "t_rohan_3";
  const { data: viewer } = await sb.from("profiles").select("id, handle, name, interests, branch").eq("handle", handle).maybeSingle();
  if (!viewer) { console.error("No such viewer:", handle); process.exit(1); }
  console.log(`\n VIEWER  @${viewer.handle}  branch=${viewer.branch}  interests=[${viewer.interests.join(", ")}]\n`);

  const { data: follows } = await sb.from("follows").select("following_id").eq("follower_id", viewer.id);
  const followIds = (follows ?? []).map((f) => f.following_id);
  const { data: myLikes } = await sb.from("likes").select("post_id").eq("user_id", viewer.id).limit(100);
  const myLikedIds = (myLikes ?? []).map((r) => r.post_id);

  // RECALL (mirrors getForYouFeed)
  const tags = [...viewer.interests, ...(viewer.branch ? [viewer.branch] : [])].map(lc);
  const live = (q) => q.is("deleted_at", null).or("expires_at.is.null,expires_at.gt.now()");
  const [recent, byTag, byBranch, byFollow] = await Promise.all([
    live(sb.from("posts").select(SELECT)).order("created_at", { ascending: false }).limit(60),
    live(sb.from("posts").select(SELECT)).overlaps("hashtags", tags).order("created_at", { ascending: false }).limit(40),
    viewer.branch ? live(sb.from("posts").select(SELECT)).overlaps("branch_tags", [viewer.branch]).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
    followIds.length ? live(sb.from("posts").select(SELECT)).in("author_id", followIds).order("created_at", { ascending: false }).limit(40) : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map();
  for (const set of [recent, byTag, byBranch, byFollow]) for (const p of set.data ?? []) byId.set(p.id, p);
  const pool = [...byId.values()];

  // BM25 relevancy
  const relevancy = new Map();
  const tsq = [...new Set(viewer.interests.concat(viewer.branch ? [viewer.branch] : []).flatMap((t) => t.split(/[^\p{L}\p{N}]+/u)).filter(Boolean).map(lc))].join(" | ");
  if (tsq) {
    const { data: matched } = await sb.from("posts").select("id").in("id", pool.map((p) => p.id)).textSearch("search_tsv", tsq);
    for (const m of matched ?? []) relevancy.set(m.id, 1);
  }
  // item-CF
  const cf = new Map();
  if (myLikedIds.length) {
    const { data: coLikers } = await sb.from("likes").select("user_id").in("post_id", myLikedIds).neq("user_id", viewer.id).limit(800);
    const coSet = [...new Set((coLikers ?? []).map((r) => r.user_id))].slice(0, 400);
    if (coSet.length) {
      const { data: coLiked } = await sb.from("likes").select("post_id").in("user_id", coSet).limit(2000);
      const counts = new Map();
      for (const r of coLiked ?? []) counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
      const max = Math.max(1, ...counts.values());
      for (const [pid, c] of counts) cf.set(pid, c / max);
    }
  }
  // PPR
  const ppr = new Map();
  for (const f of followIds) ppr.set(f, 1.0);
  if (followIds.length) {
    const { data: second } = await sb.from("follows").select("following_id").in("follower_id", followIds).limit(2000);
    for (const r of second ?? []) if (!ppr.has(r.following_id)) ppr.set(r.following_id, 0.5);
  }

  const recentTags = [];
  const scored = pool.map((p) => { const s = scorePost(p, { interests: viewer.interests, branch: viewer.branch, recentTags, relevancy, cf, ppr }); const pr = p.hashtags?.[0]?.toLowerCase(); if (pr) recentTags.push(pr); return s; });
  scored.sort((a, b) => b.score - a.score);

  console.log(` RECALL pool: ${pool.length} posts  |  BM25 hits: ${relevancy.size}  |  CF-boosted: ${cf.size}  |  PPR authors: ${ppr.size}\n`);
  console.log(" RANK  SCORE  AUTHOR(branch)            TAGS                         SIGNALS");
  console.log(" " + "-".repeat(96));
  for (let i = 0; i < Math.min(15, scored.length); i++) {
    const s = scored[i], p = s.post;
    const author = `@${p.author?.handle ?? "?"}(${p.author?.branch ?? "?"})`.padEnd(26).slice(0, 26);
    const tg = ("#" + (p.hashtags ?? []).join(" #")).padEnd(28).slice(0, 28);
    console.log(` ${String(i + 1).padStart(3)}  ${s.score.toFixed(3)}  ${author} ${tg} ${s.reason.join(",")}`);
  }

  // DISCRIMINATION METRIC: relevance of top-15 vs random baseline.
  const isRelevant = (s) => s.tagOverlap > 0 || s.branchMatch > 0 || s._rel > 0 || s._cf > 0.01 || s._ppr > 0;
  const top = scored.slice(0, 15);
  const topRel = top.filter(isRelevant).length / top.length;
  const baseRel = scored.filter(isRelevant).length / scored.length;
  console.log("\n DISCRIMINATION:");
  console.log(`   top-15 relevant to viewer : ${(topRel * 100).toFixed(0)}%`);
  console.log(`   whole-pool baseline       : ${(baseRel * 100).toFixed(0)}%`);
  console.log(`   lift                      : ${(topRel / Math.max(baseRel, 0.01)).toFixed(2)}x`);
  const avgTop = top.reduce((a, s) => a + s.score, 0) / top.length;
  const avgBottom = scored.slice(-15).reduce((a, s) => a + s.score, 0) / 15;
  console.log(`   avg score top-15 vs bottom-15 : ${avgTop.toFixed(3)} vs ${avgBottom.toFixed(3)}`);
}
main();
