// ===========================================================================
// Offline neural-ranker trainer. Runs free (local or GitHub Actions) — NEVER on
// the request path, so it adds zero deployment cost. Learns P(engage) from REAL
// interactions: feed_training (served feature vectors) joined with feed_events /
// likes (engagement labels). Trains logistic-regression + a 2-layer MLP, keeps
// whichever wins on a held-out AUC, and only marks it ACTIVE if it beats chance.
//
//   node scripts/train-ranker.mjs            # train on real logged data
//   node scripts/train-ranker.mjs --simulate # prove the trainer learns (synthetic)
// ===========================================================================
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const N = 13; // must match lib/ranker/features.ts N_FEATURES
const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const relu = (z) => (z > 0 ? z : 0);
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map((p) => p[1]);

// ---- metrics ----
function auc(scores, labels) {
  const pos = [], neg = [];
  scores.forEach((s, i) => (labels[i] ? pos : neg).push(s));
  if (!pos.length || !neg.length) return 0.5;
  let wins = 0;
  for (const p of pos) for (const n of neg) wins += p > n ? 1 : p === n ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

// ---- logistic regression (1-layer NN) ----
function trainLogReg(X, y, { epochs = 300, lr = 0.1, l2 = 1e-3 } = {}) {
  const w = new Array(N).fill(0); let b = 0;
  for (let e = 0; e < epochs; e++) {
    for (const i of shuffle([...X.keys()])) {
      const x = X[i];
      let z = b; for (let j = 0; j < N; j++) z += w[j] * x[j];
      const g = sigmoid(z) - y[i];
      for (let j = 0; j < N; j++) w[j] -= lr * (g * x[j] + l2 * w[j]);
      b -= lr * g;
    }
  }
  return { type: "logreg", w, b };
}
const predLog = (m, x) => { let z = m.b; for (let j = 0; j < N; j++) z += m.w[j] * x[j]; return sigmoid(z); };

// ---- 2-layer MLP ----
function trainMLP(X, y, { H = 8, epochs = 400, lr = 0.08, l2 = 1e-3 } = {}) {
  const rnd = () => (Math.random() - 0.5) * 0.5;
  let W1 = Array.from({ length: H }, () => Array.from({ length: N }, rnd));
  let b1 = new Array(H).fill(0);
  let W2 = Array.from({ length: H }, rnd); let b2 = 0;
  for (let e = 0; e < epochs; e++) {
    for (const i of shuffle([...X.keys()])) {
      const x = X[i];
      const znet = b1.map((bj, j) => { let z = bj; for (let k = 0; k < N; k++) z += W1[j][k] * x[k]; return z; });
      const h = znet.map(relu);
      let zo = b2; for (let j = 0; j < H; j++) zo += W2[j] * h[j];
      const p = sigmoid(zo);
      const dOut = p - y[i];
      for (let j = 0; j < H; j++) {
        const dh = dOut * W2[j] * (znet[j] > 0 ? 1 : 0);
        W2[j] -= lr * (dOut * h[j] + l2 * W2[j]);
        for (let k = 0; k < N; k++) W1[j][k] -= lr * (dh * x[k] + l2 * W1[j][k]);
        b1[j] -= lr * dh;
      }
      b2 -= lr * dOut;
    }
  }
  return { type: "mlp", W1, b1, W2, b2 };
}
function predMLP(m, x) {
  const h = m.b1.map((bj, j) => { let z = bj; for (let k = 0; k < N; k++) z += m.W1[j][k] * x[k]; return relu(z); });
  let zo = m.b2; for (let j = 0; j < h.length; j++) zo += m.W2[j] * h[j]; return sigmoid(zo);
}

function evaluate(model, X, y) {
  const pred = model.type === "logreg" ? (x) => predLog(model, x) : (x) => predMLP(model, x);
  return auc(X.map(pred), y);
}

function fitAndPick(X, y) {
  const idx = shuffle([...X.keys()]);
  const cut = Math.floor(idx.length * 0.8);
  const tr = idx.slice(0, cut), te = idx.slice(cut);
  const Xtr = tr.map((i) => X[i]), ytr = tr.map((i) => y[i]);
  const Xte = te.map((i) => X[i]), yte = te.map((i) => y[i]);
  const lr = trainLogReg(Xtr, ytr);
  const mlp = trainMLP(Xtr, ytr);
  const aLog = evaluate(lr, Xte, yte), aMlp = evaluate(mlp, Xte, yte);
  const best = aMlp >= aLog ? { model: mlp, auc: aMlp, kind: "mlp" } : { model: lr, auc: aLog, kind: "logreg" };
  return { ...best, aLog, aMlp, nTrain: tr.length, nTest: te.length };
}

// ---- simulate: prove the trainer LEARNS a known relationship ----
function simulate(n = 4000) {
  // True (hidden) preference: engagement driven mostly by semantic + behaviour +
  // network, with noise. The trainer must recover this -> AUC >> 0.5.
  const trueW = [1.8, 0.6, 0.9, 1.1, 2.0, 0.4, 0.7, 0.5, 0.3, 1.4, 0.8, 0.5, 0.4];
  const X = [], y = [];
  for (let i = 0; i < n; i++) {
    const x = Array.from({ length: N }, () => Math.random());
    let z = -6.3; for (let j = 0; j < N; j++) z += trueW[j] * x[j]; // bias centred -> ~balanced classes
    const p = sigmoid(z + (Math.random() - 0.5) * 1.5); // label noise
    X.push(x); y.push(Math.random() < p ? 1 : 0);
  }
  return { X, y };
}

async function fromDB() {
  const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n").filter((l) => l.includes("=")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }));
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  // Served feature vectors.
  const { data: train } = await sb.from("feed_training").select("user_id, post_id, features").limit(50000);
  if (!train || train.length < 200) { console.log(`Only ${train?.length ?? 0} training rows — need >=200 real impressions. Model NOT updated (cold start: MCDM engine stays).`); return { sb, ready: false }; }
  // Positive labels: any real engagement on that (user, post).
  const pairs = new Set(train.map((t) => `${t.user_id}|${t.post_id}`));
  const { data: ev } = await sb.from("feed_events").select("user_id, post_id, kind, value").in("kind", ["click", "expand", "save", "dwell"]).limit(200000);
  const { data: lk } = await sb.from("likes").select("user_id, post_id").limit(200000);
  const positive = new Set();
  for (const e of ev ?? []) if (e.kind !== "dwell" || Number(e.value) > 2000) positive.add(`${e.user_id}|${e.post_id}`);
  for (const l of lk ?? []) if (pairs.has(`${l.user_id}|${l.post_id}`)) positive.add(`${l.user_id}|${l.post_id}`);
  const X = train.map((t) => t.features), y = train.map((t) => positive.has(`${t.user_id}|${t.post_id}`) ? 1 : 0);
  return { sb, ready: true, X, y };
}

async function main() {
  const sim = process.argv.includes("--simulate");
  if (sim) {
    const { X, y } = simulate();
    const r = fitAndPick(X, y);
    console.log(`SIMULATION (proves the trainer learns):`);
    console.log(`  samples: ${X.length}  positives: ${y.filter(Boolean).length}`);
    console.log(`  holdout AUC — logreg: ${r.aLog.toFixed(3)}   mlp: ${r.aMlp.toFixed(3)}   -> picked ${r.kind} (${r.auc.toFixed(3)})`);
    console.log(`  VERDICT: ${r.auc > 0.7 ? "✅ trainer recovers the hidden preference (AUC " + r.auc.toFixed(3) + " >> 0.5 random) — the neural ranker genuinely learns" : "weak"}`);
    return;
  }
  const db = await fromDB();
  if (!db.ready) return;
  const r = fitAndPick(db.X, db.y);
  const pos = db.y.filter(Boolean).length;
  console.log(`Trained on ${db.X.length} real impressions (${pos} engaged). holdout AUC logreg=${r.aLog.toFixed(3)} mlp=${r.aMlp.toFixed(3)} -> ${r.kind} ${r.auc.toFixed(3)}`);
  const active = r.auc >= 0.6 && pos >= 50; // only go live if it genuinely beats chance
  await db.sb.from("ranker_model").upsert({ id: 1, model: r.model, auc: r.auc, n_train: r.nTrain, n_features: N, trained_at: new Date().toISOString(), active });
  console.log(active ? `✅ model ACTIVATED (AUC ${r.auc.toFixed(3)} >= 0.60) — feed now ranks with the neural net.` : `model stored but INACTIVE (AUC ${r.auc.toFixed(3)} < 0.60 or too few positives) — MCDM engine stays. Needs more real data.`);
}
main();
