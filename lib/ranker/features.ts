import type { PostWithAuthor } from "@/lib/db/posts";
import { semanticMatch } from "@/lib/ranker/taxonomy";
import type { ScoreContext } from "@/lib/ranker/score";

// Fixed feature order - MUST stay stable (the trained model indexes by position).
export const FEATURE_NAMES = [
  "semantic", "branchMatch", "bm25", "cf", "behaviorAff",
  "recency", "engagementRate", "velocity", "verified", "ppr",
  "fieldScore", "sameCollege", "sameCity",
] as const;
export const N_FEATURES = FEATURE_NAMES.length;

const lc = (s: string) => s.toLowerCase();
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const ageHours = (iso: string) => Math.max((Date.now() - new Date(iso).getTime()) / 3.6e6, 0);

export function fieldProximity(
  viewer: ScoreContext["viewer"],
  author: Record<string, unknown> | undefined,
): { score: number; sameCity: boolean; sameCollege: boolean } {
  if (!viewer || !author) return { score: 0, sameCity: false, sameCollege: false };
  const eq = (a?: unknown, b?: unknown) => a && b && lc(String(a)) === lc(String(b));
  const sameCollege = Boolean(eq(viewer.college, author.college));
  const sameBranch = Boolean(eq(viewer.branch, author.branch));
  const sameCity = Boolean(eq(viewer.city, author.city));
  let yearClose = false;
  if (viewer.year && author.year_of_study) yearClose = Math.abs(Number(viewer.year) - Number(author.year_of_study)) <= 1;
  const score = clamp01((sameCollege ? 0.5 : 0) + (sameBranch ? 0.3 : 0) + (sameCity ? 0.25 : 0) + (yearClose ? 0.15 : 0));
  return { score, sameCity, sameCollege };
}

export interface ExtractedFeatures {
  values: number[];                  // length N_FEATURES, all 0..1
  semantic: number;
  branchMatch: number;
  rel: number;
  cf: number;
  behaviorAff: number;
  velocity: number;
  ppr: number;
  field: { score: number; sameCity: boolean; sameCollege: boolean };
}

/**
 * Extract the per-(viewer, post) feature vector. This is the SINGLE source of
 * truth for both the MCDM scorer and the neural ranker - identical features at
 * serve time and (via logged vectors) at train time, so the model never sees a
 * different world than production.
 */
export function extractFeatures(post: PostWithAuthor, ctx: ScoreContext): ExtractedFeatures {
  const tags = (post.hashtags ?? []).map(lc);
  const semantic = semanticMatch(ctx.interests, tags);
  const branchMatch = ctx.branch && (post.branch_tags ?? []).some((b) => lc(b) === lc(ctx.branch as string)) ? 1 : 0;
  const rel = ctx.relevancy?.get(post.id) ?? 0;
  const cf = ctx.cf?.get(post.id) ?? 0;
  let behaviorAff = 0;
  if (ctx.behaviorAffinity) for (const t of tags) behaviorAff = Math.max(behaviorAff, ctx.behaviorAffinity.get(t) ?? 0);
  const recency = Math.exp(-ageHours(post.created_at) / 24);
  const impressions = (post as PostWithAuthor & { impressions?: number }).impressions ?? 0;
  const engagementRate = clamp01(
    (post.like_count + 2 * post.comment_count + 4 * post.bookmark_count + 8 * post.repost_count) / (impressions + 10)
  );
  const velocity = ctx.velocity?.get(post.id) ?? 0;
  const verified = (post.author as { verified?: boolean } | undefined)?.verified ? 1 : 0;
  const ppr = ctx.ppr?.get(post.author_id) ?? 0;
  const field = fieldProximity(ctx.viewer, post.author as Record<string, unknown> | undefined);

  const values = [
    semantic, branchMatch, rel, cf, behaviorAff,
    recency, engagementRate, velocity, verified, ppr,
    field.score, field.sameCollege ? 1 : 0, field.sameCity ? 1 : 0,
  ];
  return { values, semantic, branchMatch, rel, cf, behaviorAff, velocity, ppr, field };
}
