// ===========================================================================
// Tag taxonomy / synonym knowledge graph.  Zero-cost "semantic" matching: a
// curated graph where related tags live in the same cluster, so a viewer who
// declares interest "AI/ML" also matches posts tagged #llm / #deeplearning /
// #datascience, and "Web Dev" matches #react / #nextjs / #frontend.
//
// This is the classical, no-ML substitute for embeddings: human-curated meaning.
// Edit/extend freely — it is just data. Everything is lowercased + #-stripped.
// ===========================================================================

/** Each cluster = a set of mutually-related tags (a "topic"). */
const CLUSTERS: string[][] = [
  // --- Software / CS ---
  ["ai", "ml", "ai/ml", "machine learning", "deeplearning", "deep learning", "llm", "llms", "genai", "nlp", "computervision", "neuralnetworks", "datascience", "data science", "data"],
  ["webdev", "web dev", "web development", "frontend", "react", "nextjs", "next.js", "typescript", "javascript", "tailwind", "node", "fullstack", "backend", "api"],
  ["appdev", "app dev", "mobile", "flutter", "android", "ios", "reactnative", "react native", "kotlin", "swift"],
  ["cp", "competitive programming", "dsa", "leetcode", "codeforces", "algorithms", "datastructures", "data structures"],
  ["cybersecurity", "cyber", "infosec", "security", "ctf", "pentesting", "ethicalhacking", "hacking"],
  ["opensource", "open source", "oss", "github", "git", "contribution"],
  ["cloud", "devops", "aws", "azure", "gcp", "docker", "kubernetes", "k8s", "ci/cd", "infra"],
  ["blockchain", "web3", "crypto", "solidity", "ethereum", "smartcontracts"],
  // --- Core engineering ---
  ["mechanical", "cad", "ansys", "solidworks", "catia", "mechanics", "thermodynamics", "sae", "automobile"],
  ["civil", "structures", "autocad", "staad", "construction", "surveying"],
  ["electrical", "ece", "embedded", "iot", "vlsi", "circuits", "pcb", "esp32", "arduino"],
  ["robotics", "ros", "automation", "control systems", "drones", "mechatronics"],
  // --- Product / business ---
  ["startup", "startups", "founders", "founder", "entrepreneurship", "fundraising", "yc", "buildinpublic", "build in public", "mvp"],
  ["product", "productmanagement", "pm", "uiux", "ui/ux", "design", "figma", "userresearch", "ux"],
  ["finance", "fintech", "trading", "investing", "stocks", "accounting", "economics"],
  ["marketing", "growth", "branding", "socialmedia", "content", "seo"],
  // --- Career / campus ---
  ["placements", "placement", "internship", "internships", "career", "jobs", "offcampus", "off campus", "oncampus", "resume", "interview"],
  ["hackathon", "hackathons", "weekendproject", "weekend project", "buildathon"],
  ["research", "paper", "publication", "phd", "thesis"],
  // --- Creative / life ---
  ["design", "graphicdesign", "illustration", "branding"],
  ["music", "production", "guitar", "singing"],
  ["sports", "fitness", "football", "cricket", "gym"],
];

const norm = (t: string) => t.toLowerCase().trim().replace(/^#/, "");

// Build tag -> set of cluster indices.
const tagToClusters = new Map<string, Set<number>>();
CLUSTERS.forEach((cluster, i) => {
  for (const t of cluster) {
    const k = norm(t);
    if (!tagToClusters.has(k)) tagToClusters.set(k, new Set());
    tagToClusters.get(k)!.add(i);
  }
});

/**
 * Expand a set of interest/tags to all RELATED tags via shared clusters.
 * Returns a map: relatedTag -> strength (1.0 for the tag itself / direct
 * cluster members; the input tags always included). Used to widen recall and
 * to compute a graded semantic-match score (not just binary overlap).
 */
export function expandTags(tags: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const raw of tags) {
    const t = norm(raw);
    out.set(t, 1); // the declared tag itself
    const clusters = tagToClusters.get(t);
    if (!clusters) continue;
    for (const ci of clusters) {
      for (const member of CLUSTERS[ci]) {
        const m = norm(member);
        // Related-but-not-declared tags get a slightly lower weight.
        if (!out.has(m)) out.set(m, 0.7);
      }
    }
  }
  return out;
}

/** Flat list of expanded tag strings (for DB `.overlaps` recall queries). */
export function expandTagList(tags: string[]): string[] {
  return [...expandTags(tags).keys()];
}

/**
 * Graded semantic match between a viewer's interests and a post's hashtags.
 * 0..1: direct interest hit = full weight, related-cluster hit = partial.
 * This is the "it understood me even though I didn't say the exact word" signal.
 */
export function semanticMatch(interestTags: string[], postTags: string[]): number {
  if (!interestTags.length || !postTags.length) return 0;
  const exp = expandTags(interestTags);
  let best = 0;
  for (const pt of postTags) {
    const w = exp.get(norm(pt));
    if (w && w > best) best = w;
  }
  return best;
}
