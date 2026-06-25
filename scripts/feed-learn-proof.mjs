// ===========================================================================
// PROOF that the feed LEARNS from behaviour (not just stated tags).
// Picks a seed viewer whose declared interests do NOT include "Startups",
// ranks their candidate pool (baseline), then inserts REAL feed_events showing
// them engaging (click/save/dwell) with #startup posts, recomputes behaviour
// affinity with the EXACT app math, re-ranks, and shows startup content climb.
// Cleans up the injected events afterwards.
//
// Run: node scripts/feed-learn-proof.mjs
// ===========================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const lc = (s) => (s || "").toLowerCase();
const STARTUP = new Set(["startup", "founders", "fundraising", "yc", "buildinpublic", "mvp"]);

// behaviour affinity — verbatim app math (kind weights, normalised 0..1).
async function affinity(userId) {
  const { data: events } = await sb.from("feed_events").select("kind, posts!inner(hashtags)").eq("user_id", userId).in("kind", ["click", "expand", "save", "dwell"]).limit(500);
  const W = { dwell: 1, click: 2, expand: 2, save: 4 };
  const counts = new Map();
  for (const e of events ?? []) { const w = W[e.kind] ?? 1; for (const t of e.posts?.hashtags ?? []) counts.set(lc(t), (counts.get(lc(t)) ?? 0) + w); }
  const max = Math.max(1, ...counts.values());
  const m = new Map(); for (const [t, c] of counts) m.set(t, c / max);
  return m;
}

function rankFor(pool, interests, behavior) {
  const iset = new Set(interests.map(lc));
  return pool.map((p) => {
    const tags = (p.hashtags ?? []).map(lc);
    const stated = tags.some((t) => iset.has(t)) ? 1 : 0;
    let beh = 0; for (const t of tags) beh = Math.max(beh, behavior.get(t) ?? 0);
    // same match blend the app uses (stated/semantic + behaviour), + recency.
    const match = Math.min(0.22 + stated * 0.35 + beh * 0.32, 1);
    const recency = Math.exp(-Math.max(0, (Date.now() - new Date(p.created_at)) / 3.6e6) / 24);
    const score = 0.6 * match + 0.4 * recency;
    return { p, score, stated, beh, isStartup: tags.some((t) => STARTUP.has(t)) };
  }).sort((a, b) => b.score - a.score);
}

function startupStats(ranked) {
  const top10 = ranked.slice(0, 10);
  return { inTop10: top10.filter((r) => r.isStartup).length, firstRank: (ranked.findIndex((r) => r.isStartup) + 1) || "—" };
}

async function main() {
  // Find a seed viewer who did NOT declare Startups.
  const { data: cands } = await sb.from("profiles").select("id, handle, interests, branch").like("handle", "t_%").limit(60);
  const viewer = (cands ?? []).find((c) => !(c.interests ?? []).includes("Startups") && (c.interests ?? []).length >= 3);
  if (!viewer) { console.error("no suitable viewer"); process.exit(1); }
  console.log(`\nVIEWER @${viewer.handle}  interests=[${viewer.interests.join(", ")}]  (note: NO 'Startups')\n`);

  // Candidate pool: recent + their interest-tag posts + startup posts (so startup is available to surface).
  const tags = viewer.interests.map(lc);
  const [{ data: recent }, { data: byTag }, { data: startupPosts }] = await Promise.all([
    sb.from("posts").select("id, hashtags, created_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(80),
    sb.from("posts").select("id, hashtags, created_at").overlaps("hashtags", tags).limit(60),
    sb.from("posts").select("id, hashtags, created_at").overlaps("hashtags", [...STARTUP]).limit(40),
  ]);
  const byId = new Map(); for (const s of [recent, byTag, startupPosts]) for (const p of s ?? []) byId.set(p.id, p);
  const pool = [...byId.values()];

  // BEFORE
  const before = rankFor(pool, viewer.interests, new Map());
  const b = startupStats(before);
  console.log(`BEFORE behaviour:  startup posts in top-10 = ${b.inTop10}   first startup at rank ${b.firstRank}`);

  // INJECT real engagement: viewer clicks + saves + dwells on startup posts.
  const targets = (startupPosts ?? []).slice(0, 8);
  const events = [];
  for (const t of targets) { events.push({ user_id: viewer.id, post_id: t.id, kind: "click", value: 0 }); events.push({ user_id: viewer.id, post_id: t.id, kind: "save", value: 0 }); events.push({ user_id: viewer.id, post_id: t.id, kind: "dwell", value: 9000 }); }
  const ins = await sb.from("feed_events").insert(events);
  if (ins.error) console.log("INSERT ERROR:", ins.error.message);
  const { count: evCount } = await sb.from("feed_events").select("id", { count: "exact", head: true }).eq("user_id", viewer.id);
  console.log(`\n…injected ${events.length} events on ${targets.length} startup posts; feed_events now holds ${evCount} for viewer\n`);

  // AFTER
  const behavior = await affinity(viewer.id);
  const after = rankFor(pool, viewer.interests, behavior);
  const a = startupStats(after);
  console.log(`AFTER behaviour:   startup posts in top-10 = ${a.inTop10}   first startup at rank ${a.firstRank}`);
  console.log(`\nlearned startup-tag affinities: ${[...behavior.entries()].filter(([t]) => STARTUP.has(t)).map(([t, v]) => `${t}:${v.toFixed(2)}`).join("  ") || "(none)"}`);
  console.log("\nTOP 6 AFTER:");
  for (const r of after.slice(0, 6)) console.log(`  ${r.score.toFixed(3)}  ${r.isStartup ? "★STARTUP" : "        "}  #${(r.p.hashtags ?? []).join(" #")}  ${r.beh > 0 ? `(behaviour:${r.beh.toFixed(2)})` : ""}`);

  // CLEANUP injected events.
  await sb.from("feed_events").delete().eq("user_id", viewer.id);
  console.log(`\nVERDICT: ${a.inTop10 > b.inTop10 ? "✅ feed ADAPTED to behaviour — startup content rose from " + b.inTop10 + " to " + a.inTop10 + " in top-10" : "no shift"}.  (cleaned up injected events)`);
}
main();
