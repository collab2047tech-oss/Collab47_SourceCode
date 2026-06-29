import { getSupabaseServer } from "@/lib/supabase/server";
import { moderateContent } from "@/lib/moderation/moderate";

// ---------------------------------------------------------------------------
// Structured profile resume: Experience / Education / Skills.
// Reads are RLS-gated by profile privacy (public OR owner OR connection);
// writes are owner-only (enforced by RLS + the auth.uid() checks below).
// ---------------------------------------------------------------------------

export type ExperienceType = "work" | "internship" | "project" | "research" | "volunteer" | "leadership";
export type SkillCategory = "technical" | "soft" | "tool" | "language";

export interface Experience {
  id: string;
  user_id: string;
  type: ExperienceType;
  title: string;
  organization: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  skills: string[];
  url: string | null;
  sort_order: number;
}

export interface Education {
  id: string;
  user_id: string;
  institution: string;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  grade: string | null;
  description: string | null;
  sort_order: number;
}

export interface Skill {
  id: string;
  user_id: string;
  name: string;
  category: SkillCategory;
}

export interface Resume {
  experience: Experience[];
  education: Education[];
  skills: Skill[];
}

const EMPTY: Resume = { experience: [], education: [], skills: [] };

/** Full resume for a user (RLS gates visibility for the current viewer). */
export async function getResume(userId: string): Promise<Resume> {
  const sb = await getSupabaseServer();
  if (!sb) return EMPTY;
  const [exp, edu, sk] = await Promise.all([
    sb.from("profile_experience").select("*").eq("user_id", userId).order("is_current", { ascending: false }).order("start_date", { ascending: false }),
    sb.from("profile_education").select("*").eq("user_id", userId).order("is_current", { ascending: false }).order("start_date", { ascending: false }),
    sb.from("profile_skills").select("*").eq("user_id", userId).order("category", { ascending: true }).order("name", { ascending: true }),
  ]);
  return {
    experience: (exp.data as Experience[] | null) ?? [],
    education: (edu.data as Education[] | null) ?? [],
    skills: (sk.data as Skill[] | null) ?? [],
  };
}

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

async function authed() {
  const sb = await getSupabaseServer();
  if (!sb) return { sb: null, uid: null };
  const { data: { user } } = await sb.auth.getUser();
  return { sb, uid: user?.id ?? null };
}

const clamp = (s: unknown, n: number) => (typeof s === "string" ? s.trim().slice(0, n) : "");
const cleanDate = (s: unknown) => (typeof s === "string" && s.trim() ? s.trim() : null);

// ---- Experience ----
export type ExperienceInput = Omit<Experience, "id" | "user_id" | "sort_order">;

export async function upsertExperience(input: ExperienceInput & { id?: string }): Promise<Result<{ id: string }>> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const title = clamp(input.title, 150);
  if (!title) return { ok: false, error: "Title is required" };
  const row = {
    user_id: uid,
    type: input.type,
    title,
    organization: clamp(input.organization, 150) || null,
    location: clamp(input.location, 120) || null,
    start_date: cleanDate(input.start_date),
    end_date: input.is_current ? null : cleanDate(input.end_date),
    is_current: Boolean(input.is_current),
    description: clamp(input.description, 2000) || null,
    skills: Array.isArray(input.skills) ? [...new Set(input.skills.map((s) => clamp(s, 40).toLowerCase()).filter(Boolean))].slice(0, 12) : [],
    url: clamp(input.url, 300) || null,
  };
  // Moderate the free-text (title + organization + description) in one pass
  // before the write; URLs/dates/enums/skills are not moderated here.
  const moderationText = [row.title, row.organization, row.description]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
  const moderationResult = await moderateContent(moderationText);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }
  if (input.id) {
    const { error } = await sb.from("profile_experience").update(row).eq("id", input.id).eq("user_id", uid);
    return error ? { ok: false, error: error.message } : { ok: true, data: { id: input.id } };
  }
  const { data, error } = await sb.from("profile_experience").insert(row).select("id").single();
  return error ? { ok: false, error: error.message } : { ok: true, data: { id: data.id as string } };
}

export async function deleteExperience(id: string): Promise<Result> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("profile_experience").delete().eq("id", id).eq("user_id", uid);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---- Education ----
export type EducationInput = Omit<Education, "id" | "user_id" | "sort_order">;

export async function upsertEducation(input: EducationInput & { id?: string }): Promise<Result<{ id: string }>> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const institution = clamp(input.institution, 200);
  if (!institution) return { ok: false, error: "Institution is required" };
  const row = {
    user_id: uid,
    institution,
    degree: clamp(input.degree, 120) || null,
    field_of_study: clamp(input.field_of_study, 120) || null,
    start_date: cleanDate(input.start_date),
    end_date: input.is_current ? null : cleanDate(input.end_date),
    is_current: Boolean(input.is_current),
    grade: clamp(input.grade, 60) || null,
    description: clamp(input.description, 2000) || null,
  };
  // Moderate the free-text (institution + degree + field + description) in one
  // pass before the write; dates/grade are not moderated.
  const moderationText = [row.institution, row.degree, row.field_of_study, row.description]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" ");
  const moderationResult = await moderateContent(moderationText);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }
  if (input.id) {
    const { error } = await sb.from("profile_education").update(row).eq("id", input.id).eq("user_id", uid);
    return error ? { ok: false, error: error.message } : { ok: true, data: { id: input.id } };
  }
  const { data, error } = await sb.from("profile_education").insert(row).select("id").single();
  return error ? { ok: false, error: error.message } : { ok: true, data: { id: data.id as string } };
}

export async function deleteEducation(id: string): Promise<Result> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("profile_education").delete().eq("id", id).eq("user_id", uid);
  return error ? { ok: false, error: error.message } : { ok: true };
}

// ---- Skills ----
export async function addSkill(name: string, category: SkillCategory): Promise<Result<{ id: string }>> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const clean = clamp(name, 50);
  if (!clean) return { ok: false, error: "Skill name is required" };
  // Moderate the free-text skill name before the write (category is an enum).
  const moderationResult = await moderateContent(clean);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }
  const { data, error } = await sb
    .from("profile_skills")
    .insert({ user_id: uid, name: clean, category })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("duplicate") || error.code === "23505") return { ok: false, error: "You already added that skill" };
    return { ok: false, error: error.message };
  }
  return { ok: true, data: { id: data.id as string } };
}

export async function deleteSkill(id: string): Promise<Result> {
  const { sb, uid } = await authed();
  if (!sb || !uid) return { ok: false, error: "Not signed in" };
  const { error } = await sb.from("profile_skills").delete().eq("id", id).eq("user_id", uid);
  return error ? { ok: false, error: error.message } : { ok: true };
}
