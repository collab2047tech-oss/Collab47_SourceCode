// ===========================================================================
// Feed-matching test seed. Creates ~50 varied TEST profiles + ~950 tagged posts
// + follows + likes, so the For-You matching engine can be validated end-to-end.
//
// ALL test rows are flagged: auth emails end in @collab47.test and handles start
// with "t_". Cleanup: node scripts/seed-feed-test.mjs --clean  (cascade-deletes).
//
// Run:  node scripts/seed-feed-test.mjs         (clean previous test rows, reseed)
//       node scripts/seed-feed-test.mjs --clean (only delete test rows)
//
// Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// ===========================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SRK) throw new Error("Missing Supabase env");
const sb = createClient(URL_, SRK, { auth: { persistSession: false } });

const PASSWORD = "TestPass12345!";
const rand = (a) => a[Math.floor(Math.random() * a.length)];
const sample = (a, n) => [...a].sort(() => Math.random() - 0.5).slice(0, n);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Cleanup -------------------------------------------------------------
async function clean() {
  console.log("Cleaning previous test rows…");
  let page = 1, removed = 0;
  for (;;) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const testers = data.users.filter((u) => (u.email ?? "").endsWith("@collab47.test"));
    for (const u of testers) {
      await sb.auth.admin.deleteUser(u.id); // cascades profile/posts/likes/follows
      removed++;
    }
    if (data.users.length < 1000) break;
    page++;
  }
  console.log(`Removed ${removed} test users (cascade).`);
}

// --- Personas ------------------------------------------------------------
const COLLEGES = ["Thapar Institute", "Delhi Technological University", "IIT Bombay", "NIT Trichy", "VIT Vellore", "Govt Engineering College Ajmer"];
const BRANCHES = ["CSE", "ECE", "Mechanical", "Design", "Civil", "Business"];
const CITIES = ["Patiala", "Delhi", "Mumbai", "Trichy", "Vellore", "Ajmer", "Bengaluru"];

// interest -> hashtag topic mapping (what posts tagged with these look like)
const TOPICS = {
  "AI/ML":        ["ai", "ml", "deeplearning", "llm", "datascience"],
  "Web Dev":      ["webdev", "react", "nextjs", "typescript", "frontend"],
  "App Dev":      ["appdev", "flutter", "android", "ios", "reactnative"],
  "Design":       ["design", "uiux", "figma", "product"],
  "Startups":     ["startup", "founders", "fundraising", "yc"],
  "Hackathons":   ["hackathon", "buildinpublic", "weekendproject"],
  "Robotics":     ["robotics", "embedded", "iot", "ros"],
  "Cybersecurity":["cybersecurity", "infosec", "ctf"],
  "Mechanical":   ["mechanical", "cad", "ansys", "solidworks"],
  "Civil":        ["civil", "structures", "autocad"],
  "Placements":   ["placements", "internship", "career", "offcampus"],
  "Open Source":  ["opensource", "github", "oss"],
  "CP":           ["cp", "leetcode", "dsa", "codeforces"],
  "Finance":      ["finance", "fintech", "trading"],
};
const INTERESTS = Object.keys(TOPICS);

// Post body templates per topic (real-ish, varied — these are TEST rows).
const BODIES = {
  "AI/ML": ["Shipped a tiny transformer from scratch this weekend — backprop finally clicked.", "Fine-tuned a small LLM on my notes. Retrieval > bigger model, every time.", "Built an image classifier hitting 94% on a custom dataset. Notes in thread."],
  "Web Dev": ["Rewrote our dashboard in Next.js App Router. Server components are wild.", "TIL: a single useMemo killed a re-render storm in our React app.", "Shipped a full-stack side project: Next.js + Supabase + RLS. Live now."],
  "App Dev": ["Released v1 of my Flutter app for campus events. 200 installs day one.", "React Native + Expo got me to a working prototype in a weekend."],
  "Design": ["Redesigned our onboarding in Figma — cut steps from 6 to 3.", "A good empty state is a feature, not an afterthought. Case study soon."],
  "Startups": ["Talked to 20 students this week. The placement-prep pain is real.", "Bootstrapped MRR crossed a small milestone. Slow is smooth.", "Cold emails > warm intros when you have actual traction to show."],
  "Hackathons": ["Won runner-up at the 24h hackathon. Built it, broke it, fixed it at 4am.", "Shipping a weekend project every Sunday this month. Build in public."],
  "Robotics": ["Got my line-follower bot under 12s on the track. PID tuning is an art.", "Wired up an ESP32 + sensors for a smart-irrigation demo."],
  "Cybersecurity": ["Solved a tricky web CTF — SSRF chained to RCE. Writeup coming.", "Set up a home lab for pentesting practice. Notes below."],
  "Mechanical": ["Finished a full ANSYS stress analysis for the SAE chassis.", "Parametric CAD model of a gearbox — SolidWorks rebuild was clean."],
  "Civil": ["STAAD model for a G+3 frame done. Load combinations matter more than you think.", "Site visit notes: theory vs the actual pour are two different worlds."],
  "Placements": ["Cracked an off-campus SDE offer. DSA + 2 real projects did it.", "Internship season tips: ship something public, recruiters actually read it."],
  "Open Source": ["First PR merged into a real OSS project today. Terrifying and great.", "Maintaining a small library taught me more than any course."],
  "CP": ["Hit a new rating peak on Codeforces. Graphs week paid off.", "365 days of LeetCode streak. DP is finally intuitive."],
  "Finance": ["Built a backtesting notebook for a simple momentum strategy.", "Fintech UX in India is wide open. Lots to build here."],
};

function makePersona(i) {
  // Distribute: ~42 students, 4 startups, 2 companies, 2 academies.
  let kind = "student";
  if (i >= 42 && i < 46) kind = "startup";
  else if (i >= 46 && i < 48) kind = "company";
  else if (i >= 48) kind = "academy";

  const branch = rand(BRANCHES);
  const college = rand(COLLEGES);
  const interests = sample(INTERESTS, 3 + Math.floor(Math.random() * 2));
  const n = i + 1;
  let name, handle, bio, br = branch, col = college;
  if (kind === "startup") {
    name = rand(["Lumen Labs", "Forge", "Pickle", "Tatva", "Nivaan"]) + " (Startup)";
    handle = `t_startup_${n}`;
    bio = "Early-stage student startup. Hiring builders.";
    br = "Startup"; col = "Bootstrapped";
  } else if (kind === "company") {
    name = rand(["Zylker", "Hexa Systems"]) + " (Company)";
    handle = `t_company_${n}`;
    bio = "We hire interns from campuses across India.";
    br = "Industry"; col = "Industry";
  } else if (kind === "academy") {
    name = rand(["CodeKarma Academy", "LaunchPad Coaching"]);
    handle = `t_academy_${n}`;
    bio = "Upskilling students for placements and beyond.";
    br = "Academy"; col = "Academy";
  } else {
    const first = rand(["Aarav", "Diya", "Kabir", "Ananya", "Vivaan", "Isha", "Reyansh", "Sara", "Arjun", "Myra", "Ved", "Kiara", "Rohan", "Tara", "Neel", "Zoya", "Dev", "Anika", "Yuvan", "Mira"]);
    const last = rand(["Sharma", "Patel", "Singh", "Nair", "Reddy", "Das", "Gupta", "Mehta", "Iyer", "Bose"]);
    name = `${first} ${last}`;
    handle = `t_${first.toLowerCase()}_${n}`;
  }
  return { kind, name, handle, bio, branch: br, college: col, interests, city: rand(CITIES), idx: i };
}

async function seed() {
  await clean();
  const N = 50;
  console.log(`Creating ${N} test users…`);
  const personas = Array.from({ length: N }, (_, i) => makePersona(i));
  const created = [];
  for (const p of personas) {
    const email = `${p.handle}@collab47.test`;
    const { data, error } = await sb.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
    if (error) { console.warn("createUser fail", email, error.message); continue; }
    created.push({ ...p, id: data.user.id });
    await sleep(40);
  }
  console.log(`Created ${created.length} auth users. Upserting profiles…`);
  const { error: pErr } = await sb.from("profiles").upsert(
    created.map((p) => ({
      id: p.id, handle: p.handle, name: p.name, bio: p.bio,
      college: p.college, branch: p.branch, interests: p.interests,
      city: p.city, year_of_study: String(1 + Math.floor(Math.random() * 4)),
      onboarded: true,
    }))
  );
  if (pErr) throw pErr;

  // --- Posts: ~950, distributed; tagged by the author's interests. ----------
  console.log("Generating posts…");
  const rows = [];
  const TARGET = 950;
  const now = Date.now();
  while (rows.length < TARGET) {
    for (const p of created) {
      if (rows.length >= TARGET) break;
      const topic = rand(p.interests.filter((t) => BODIES[t]) .length ? p.interests.filter((t) => BODIES[t]) : INTERESTS.filter((t)=>BODIES[t]));
      const tags = sample(TOPICS[topic], 2 + Math.floor(Math.random() * 3));
      const body = rand(BODIES[topic]);
      const ageMs = Math.floor(Math.random() * 7 * 86400_000); // last 7 days
      rows.push({
        author_id: p.id,
        body,
        hashtags: tags,
        branch_tags: p.branch ? [p.branch] : [],
        created_at: new Date(now - ageMs).toISOString(),
      });
    }
  }
  // chunked insert
  for (let i = 0; i < rows.length; i += 250) {
    const { error } = await sb.from("posts").insert(rows.slice(i, i + 250));
    if (error) throw error;
    process.stdout.write(`  posts ${Math.min(i + 250, rows.length)}/${rows.length}\r`);
  }
  console.log(`\nInserted ${rows.length} posts.`);

  // --- Follows: each follows ~6 others, biased to shared interests. ---------
  console.log("Seeding follows…");
  const follows = [];
  for (const a of created) {
    const candidates = created.filter((b) => b.id !== a.id);
    const shared = candidates.filter((b) => b.interests.some((x) => a.interests.includes(x)));
    const picks = sample(shared.length >= 6 ? shared : candidates, 6);
    for (const b of picks) follows.push({ follower_id: a.id, following_id: b.id });
  }
  for (let i = 0; i < follows.length; i += 250) {
    await sb.from("follows").upsert(follows.slice(i, i + 250), { onConflict: "follower_id,following_id", ignoreDuplicates: true });
  }
  console.log(`Inserted ~${follows.length} follows.`);

  // --- Likes: cluster by interest so item-CF has signal. --------------------
  console.log("Seeding likes…");
  const { data: allPosts } = await sb.from("posts").select("id, author_id, hashtags").in("author_id", created.map((c) => c.id)).limit(2000);
  const likes = [];
  for (const a of created) {
    const aTopics = new Set(a.interests.flatMap((t) => TOPICS[t] ?? []));
    const likable = (allPosts ?? []).filter((p) => p.author_id !== a.id && (p.hashtags ?? []).some((h) => aTopics.has(h)));
    for (const p of sample(likable, Math.min(12, likable.length))) likes.push({ user_id: a.id, post_id: p.id });
  }
  for (let i = 0; i < likes.length; i += 250) {
    await sb.from("likes").upsert(likes.slice(i, i + 250), { onConflict: "user_id,post_id", ignoreDuplicates: true });
  }
  console.log(`Inserted ~${likes.length} likes.`);

  console.log("\nSEED COMPLETE. Sample viewers (password " + PASSWORD + "):");
  for (const p of created.slice(0, 5)) console.log(`  ${p.handle}@collab47.test  [${p.branch}] interests: ${p.interests.join(", ")}`);
}

const mode = process.argv[2];
if (mode === "--clean") { await clean(); console.log("Done."); }
else { await seed(); }
