import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";
import { moderateContent } from "@/lib/moderation/moderate";
import type { ProjectCategory, ProjectRole } from "@/lib/supabase/types";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

/** Field-keyed floor a caller can jump back to (mirrors the wizard steps). */
export type CreateProjectField = "title" | "brief" | "deliverable" | "roles";

const CATEGORY_SLUGS: ProjectCategory[] = [
  "web", "mobile", "ml", "research", "design", "hardware", "social", "other",
];

/** Known duration chips -> day offsets used to derive the NOT-NULL deadline. */
const DURATION_DAYS: Record<string, number> = {
  "2 weeks": 14,
  "1 month": 30,
  "3 months": 90,
  "6 months+": 180,
};

/**
 * The `projects.deadline` column is `date NOT NULL`, but the structured wizard
 * captures a *duration* instead of a hard date. Derive an honest future date
 * from the chosen duration so the column stays satisfied without fabricating a
 * user-facing "due" claim (freeform / unknown durations get a neutral 60-day
 * window). Returns YYYY-MM-DD for the `date` column.
 */
function deriveDeadline(duration: string | null): string {
  const days = duration && DURATION_DAYS[duration] ? DURATION_DAYS[duration] : 60;
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Sanitize the roles array before it is written to the `roles` jsonb column.
 * Drops rows without a title, trims + de-dupes skills, clamps count to 1-3, and
 * caps the whole array. Never trusts client shape.
 */
function sanitizeRoles(input: unknown): ProjectRole[] {
  if (!Array.isArray(input)) return [];
  const out: ProjectRole[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === "string" ? r.title.trim().slice(0, 80) : "";
    if (!title) continue;

    const skills: string[] = [];
    const seen = new Set<string>();
    const skillsRaw = Array.isArray(r.skills) ? r.skills : [];
    for (const s of skillsRaw) {
      if (typeof s !== "string") continue;
      const t = s.trim().slice(0, 40);
      const key = t.toLowerCase();
      if (!t || seen.has(key)) continue;
      seen.add(key);
      skills.push(t);
      if (skills.length >= 12) break;
    }

    let count = typeof r.count === "number" ? Math.floor(r.count) : 1;
    if (!Number.isFinite(count) || count < 1) count = 1;
    if (count > 3) count = 3;

    out.push({ title, skills, count });
    if (out.length >= 8) break;
  }
  return out;
}

export async function createProject(input: {
  title: string;
  brief: string;
  deliverable: string;
  roles: ProjectRole[];
  commitmentHours?: number | null;
  duration?: string | null;
  category?: string | null;
}): Promise<{
  ok: boolean;
  projectId?: string;
  shortId?: string;
  error?: string;
  field?: CreateProjectField;
}> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Clamp free-text fields server-side to guard against storage bloat/abuse
  // (mirrors the clampText pattern in lib/db/events.ts).
  const title = input.title.trim().slice(0, 160);
  const brief = input.brief.trim().slice(0, 4000);
  const deliverable = input.deliverable.trim().slice(0, 2000);

  // Substance floors - AUTHORITATIVE. The wizard mirrors these client-side, but
  // the server is the real gate that killed the "1-char title goes live" bug.
  if (title.length < 8) {
    return { ok: false, field: "title", error: "Give your project a clear title of at least 8 characters." };
  }
  if (brief.length < 140) {
    return { ok: false, field: "brief", error: "The brief needs at least 140 characters so applicants understand the work." };
  }
  if (!deliverable) {
    return { ok: false, field: "deliverable", error: "Describe what the team will deliver." };
  }

  const roles = sanitizeRoles(input.roles);
  if (roles.length === 0) {
    return { ok: false, field: "roles", error: "Add at least one role you need on the team." };
  }

  const category = CATEGORY_SLUGS.includes(input.category as ProjectCategory)
    ? (input.category as ProjectCategory)
    : null;

  let commitment_hours: number | null = null;
  if (typeof input.commitmentHours === "number" && Number.isFinite(input.commitmentHours)) {
    commitment_hours = Math.max(1, Math.min(80, Math.floor(input.commitmentHours)));
  }

  const duration = input.duration ? input.duration.trim().slice(0, 40) || null : null;
  const deadline = deriveDeadline(duration);

  // Moderate all world-readable free-text (title + brief + deliverable + role
  // titles + skills) in one pass before insert.
  const moderationText = [title, brief, deliverable, ...roles.flatMap((r) => [r.title, ...r.skills])]
    .filter((v): v is string => Boolean(v))
    .join(" ");
  const moderationResult = await moderateContent(moderationText);
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }

  const { data: project, error: insertErr } = await sb
    .from("projects")
    .insert({
      title,
      brief,
      deliverable,
      deadline,
      // slot_count is intentionally omitted: migration 0054 set the column
      // default to 4, so the old hardcode is gone (mentor directive: no slot UI).
      roles,
      commitment_hours,
      duration,
      category,
      author_id: user.id,
      status: "open",
    })
    .select("id, short_id")
    .single();

  if (insertErr || !project) {
    return { ok: false, error: insertErr?.message ?? "Failed to create project." };
  }

  await sb.from("project_members").insert({
    project_id: project.id,
    user_id: user.id,
    role: "owner",
  });

  return { ok: true, projectId: project.id, shortId: project.short_id };
}

export async function getProjectByShortId(shortId: string) {
  const sb = await getSupabaseServer();
  if (!sb) return null;

  const { data } = await sb
    .from("projects")
    .select("*, author:profiles!projects_author_id_fkey(id,handle,name,avatar_url,college)")
    .eq("short_id", shortId)
    .maybeSingle();

  return data ?? null;
}

export async function listOpenProjects(limit = 20) {
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("projects")
    .select(
      "*, author:profiles!projects_author_id_fkey(id,handle,name,avatar_url,college), members:project_members(count)"
    )
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  // Normalize the embedded count aggregate into a flat `member_count` field so
  // the list can render *open* slots (slot_count - accepted members) correctly.
  return (data ?? []).map((p: Record<string, unknown>) => {
    const members = p.members as Array<{ count: number }> | undefined;
    const memberCount = members?.[0]?.count ?? 0;
    return { ...p, member_count: memberCount };
  });
}

export type ProjectListFilter = "open" | "forming" | "delivered" | "all";

/** Commitment-band filter for the discovery grid (maps onto commitment_hours). */
export type CommitmentBand = "light" | "part" | "significant" | "heavy";

/**
 * Discovery listing with status filter + optional text search.
 *  - "open"      -> status = 'open' (accepting applications)
 *  - "forming"   -> team_formed / in_progress (team assembled, work underway)
 *  - "delivered" -> shipped projects (portfolio-grade outcomes)
 *  - "all"       -> everything, newest first
 * Optional `category` (legacy null rows are grouped under "other") and
 * `commitment` band narrow the list further. Each row is annotated with
 * `member_count` so callers can render open slots.
 */
export async function listProjects(opts: {
  filter?: ProjectListFilter;
  search?: string;
  category?: string;
  commitment?: string;
  limit?: number;
} = {}) {
  const { filter = "open", search, category, commitment, limit = 24 } = opts;
  const sb = await getSupabaseServer();
  if (!sb) return [];

  let query = sb
    .from("projects")
    .select(
      "*, author:profiles!projects_author_id_fkey(id,handle,name,avatar_url,college), members:project_members(count)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter === "open") {
    query = query.eq("status", "open");
  } else if (filter === "forming") {
    query = query.in("status", ["team_formed", "in_progress"]);
  } else if (filter === "delivered") {
    query = query.eq("status", "delivered");
  }

  // Category filter. Legacy rows (category IS NULL) live under "other" so they
  // stay discoverable and never silently vanish from the grid.
  if (category) {
    if (category === "other") {
      query = query.or("category.is.null,category.eq.other");
    } else {
      query = query.eq("category", category);
    }
  }

  // Commitment band over commitment_hours. Legacy rows (null) never match a
  // band - a project can't be filtered into an effort it never claimed.
  if (commitment === "light") {
    query = query.lt("commitment_hours", 5);
  } else if (commitment === "part") {
    query = query.gte("commitment_hours", 5).lt("commitment_hours", 10);
  } else if (commitment === "significant") {
    query = query.gte("commitment_hours", 10).lt("commitment_hours", 20);
  } else if (commitment === "heavy") {
    query = query.gte("commitment_hours", 20);
  }

  const term = search?.trim();
  if (term) {
    // Escape PostgREST `or` reserved characters in user input.
    const safe = term.replace(/[%,()]/g, " ").trim();
    if (safe) {
      query = query.or(`title.ilike.%${safe}%,brief.ilike.%${safe}%`);
    }
  }

  const { data } = await query;

  return (data ?? []).map((p: Record<string, unknown>) => {
    const members = p.members as Array<{ count: number }> | undefined;
    const memberCount = members?.[0]?.count ?? 0;
    return { ...p, member_count: memberCount };
  });
}

export async function applyToProject(input: {
  projectId: string;
  pitch: string;
  links: string[];
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: project } = await sb
    .from("projects")
    .select("author_id, status")
    .eq("id", input.projectId)
    .maybeSingle();

  if (!project) {
    return { ok: false, error: "Project not found." };
  }

  if (project.author_id === user.id) {
    return { ok: false, error: "Authors cannot apply to their own project." };
  }

  if (project.status !== "open") {
    return { ok: false, error: "This project is no longer accepting applications." };
  }

  if (!input.pitch.trim()) {
    return { ok: false, error: "A pitch is required." };
  }

  if (input.pitch.length > 800) {
    return { ok: false, error: "Pitch must be 800 characters or fewer." };
  }

  if (input.links.length > 3) {
    return { ok: false, error: "You can attach at most 3 links." };
  }

  // Sanitize link strings: keep only valid http(s) URLs (mirrors the
  // deliverable_url validation below), cap each to 500 chars, drop the rest.
  // Prevents stored XSS (e.g. javascript:) when the author clicks a link.
  const safeLinks = input.links.reduce<string[]>((acc, l) => {
    if (typeof l !== "string") return acc;
    const trimmed = l.trim().slice(0, 500);
    if (!trimmed) return acc;
    try {
      const u = new URL(trimmed);
      if (u.protocol === "http:" || u.protocol === "https:") acc.push(u.toString());
    } catch {
      /* drop invalid URLs */
    }
    return acc;
  }, []);

  // A user who is already on the team should not be able to apply again.
  const { data: existingMember } = await sb
    .from("project_members")
    .select("user_id")
    .eq("project_id", input.projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMember) {
    return { ok: false, error: "You are already a member of this project." };
  }

  // Moderate the free-text pitch before insert - applications are visible to
  // the project author (mirrors the single-pass gate in lib/db/events.ts).
  const moderationResult = await moderateContent(input.pitch.trim());
  if (!moderationResult.ok) {
    return { ok: false, error: moderationResult.reason ?? "Content blocked by policy." };
  }

  const { error } = await sb.from("project_applications").insert({
    project_id: input.projectId,
    applicant_id: user.id,
    pitch: input.pitch,
    links: safeLinks,
    status: "pending",
  });

  if (error) {
    if (error.message.toLowerCase().includes("duplicate")) {
      return { ok: false, error: "You have already applied." };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}

export async function getProjectApplications(projectId: string) {
  if (!supabaseConfigured) return [];
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("project_applications")
    .select("*, applicant:profiles!project_applications_applicant_id_fkey(id,handle,name,avatar_url,college)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  return data ?? [];
}

export async function acceptApplicant(input: {
  projectId: string;
  applicantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Only the project author may accept applicants.
  const { data: project } = await sb
    .from("projects")
    .select("author_id, short_id, slot_count, status")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can accept applicants." };

  // Privileged writes (membership + conversation management) via service role.
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  // The applicant must have a pending application - guards against accepting a
  // user who never applied (or whose application was already resolved).
  const { data: application } = await admin
    .from("project_applications")
    .select("status")
    .eq("project_id", input.projectId)
    .eq("applicant_id", input.applicantId)
    .maybeSingle();
  if (!application) return { ok: false, error: "No application found for this user." };
  if (application.status === "accepted") return { ok: false, error: "This applicant is already on the team." };

  // Is the applicant already a member? If so, accepting again is a no-op and
  // must NOT be blocked by the cap (re-confirmation shouldn't fail).
  const { data: alreadyMember } = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", input.projectId)
    .eq("user_id", input.applicantId)
    .maybeSingle();

  // Enforce the 5-member cap on ACCEPT (owner counts toward the 5). Applying is
  // never blocked - only the act of accepting a 6th member is.
  if (!alreadyMember) {
    const { count: memberCount } = await admin
      .from("project_members")
      .select("user_id", { count: "exact", head: true })
      .eq("project_id", input.projectId);
    if ((memberCount ?? 0) >= 5) {
      return { ok: false, error: "This project is full (maximum of 5 members). Reject another member before accepting a new one." };
    }
  }

  const { error: updateErr } = await admin
    .from("project_applications")
    .update({ status: "accepted" })
    .eq("project_id", input.projectId)
    .eq("applicant_id", input.applicantId);

  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: memberErr } = await admin
    .from("project_members")
    .upsert(
      { project_id: input.projectId, user_id: input.applicantId, role: "member" },
      { onConflict: "project_id,user_id" }
    );

  if (memberErr) return { ok: false, error: memberErr.message };

  // Transition the project to "team_formed" once the team fills the author's
  // requested slots (capped at the hard 5-member ceiling), so it drops out of
  // the open-discovery list and stops accepting applications.
  if (project.status === "open") {
    const { count: filledCount } = await admin
      .from("project_members")
      .select("user_id", { count: "exact", head: true })
      .eq("project_id", input.projectId);
    const effectiveCap = Math.min(project.slot_count + 1, 5); // slots + owner, capped at 5
    if ((filledCount ?? 0) >= effectiveCap) {
      await admin
        .from("projects")
        .update({ status: "team_formed" })
        .eq("id", input.projectId);
    }
  }

  const { data: existingConv } = await admin
    .from("conversations")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("type", "group")
    .maybeSingle();

  if (!existingConv) {
    const { data: newConv, error: convErr } = await admin
      .from("conversations")
      .insert({ type: "group", project_id: input.projectId })
      .select("id")
      .single();

    if (convErr || !newConv) return { ok: false, error: convErr?.message ?? "Failed to create group conversation." };

    const { data: members } = await admin
      .from("project_members")
      .select("user_id")
      .eq("project_id", input.projectId);

    if (members && members.length > 0) {
      const convMembers = members.map((m: { user_id: string }) => ({
        conversation_id: newConv.id,
        user_id: m.user_id,
      }));
      await admin.from("conversation_members").upsert(convMembers, { onConflict: "conversation_id,user_id" });
    }
  } else {
    await admin
      .from("conversation_members")
      .upsert(
        { conversation_id: existingConv.id, user_id: input.applicantId },
        { onConflict: "conversation_id,user_id" }
      );
  }

  // Fire-and-forget: notify the applicant that they were accepted.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      await createNotification({
        userId: input.applicantId,
        kind: "project_accepted",
        actorName: actor.name,
        text: `${actor.name} accepted your application`,
        href: `/c/${project.short_id as string}`,
      });
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

export async function rejectApplicant(input: {
  projectId: string;
  applicantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Only the project author may reject applicants.
  const { data: project } = await sb
    .from("projects")
    .select("author_id, status")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can reject applicants." };

  // The author cannot reject themselves out of their own project.
  if (input.applicantId === project.author_id) {
    return { ok: false, error: "You cannot remove yourself from your own project." };
  }

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  const { error } = await admin
    .from("project_applications")
    .update({ status: "rejected" })
    .eq("project_id", input.projectId)
    .eq("applicant_id", input.applicantId);

  if (error) return { ok: false, error: error.message };

  // If the rejected user had already been accepted onto the team, remove their
  // membership and (if the team was full) reopen the project for applications.
  await admin
    .from("project_members")
    .delete()
    .eq("project_id", input.projectId)
    .eq("user_id", input.applicantId)
    .eq("role", "member");

  if (project.status === "team_formed") {
    await admin
      .from("projects")
      .update({ status: "open" })
      .eq("id", input.projectId);
  }

  return { ok: true };
}

export async function getProjectMembers(projectId: string) {
  if (!supabaseConfigured) return [];
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("project_members")
    .select("*, profile:profiles!project_members_user_id_fkey(id,handle,name,avatar_url,college)")
    .eq("project_id", projectId);

  return data ?? [];
}

export async function getMyProjectApplicationState(projectId: string): Promise<{
  applied: boolean;
  status: "pending" | "accepted" | "rejected" | null;
}> {
  if (!supabaseConfigured) return { applied: false, status: null };
  const sb = await getSupabaseServer();
  if (!sb) return { applied: false, status: null };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { applied: false, status: null };

  const { data } = await sb
    .from("project_applications")
    .select("status")
    .eq("project_id", projectId)
    .eq("applicant_id", user.id)
    .maybeSingle();

  if (!data) return { applied: false, status: null };
  return { applied: true, status: data.status as "pending" | "accepted" | "rejected" };
}

// ---------------------------------------------------------------------------
// Progress posts for a project
// ---------------------------------------------------------------------------

export async function getProjectProgressPosts(projectId: string) {
  if (!supabaseConfigured) return [];
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("posts")
    .select("*, author:profiles!posts_author_id_fkey(id,handle,name,avatar_url)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(50);

  return data ?? [];
}

// ---------------------------------------------------------------------------
// Mark project delivered + verify all members
// ---------------------------------------------------------------------------

export async function markProjectDelivered(input: {
  projectId: string;
  deliverableUrl: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: false, error: "Database not connected." };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  // Validate the deliverable URL is a real http(s) link.
  let normalizedUrl: string;
  try {
    const u = new URL(input.deliverableUrl);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return { ok: false, error: "Deliverable URL must start with http:// or https://" };
    }
    normalizedUrl = u.toString();
  } catch {
    return { ok: false, error: "Please enter a valid deliverable URL." };
  }

  const { data: project } = await sb
    .from("projects")
    .select("author_id, short_id, status")
    .eq("id", input.projectId)
    .maybeSingle();

  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can mark it delivered." };
  if (project.status === "delivered") return { ok: false, error: "This project has already been delivered." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  const { error: projectErr } = await admin
    .from("projects")
    .update({
      delivered_at: new Date().toISOString(),
      deliverable_url: normalizedUrl,
      status: "delivered",
    })
    .eq("id", input.projectId);

  if (projectErr) return { ok: false, error: projectErr.message };

  const { error: membersErr } = await admin
    .from("project_members")
    .update({ is_verified: true })
    .eq("project_id", input.projectId);

  if (membersErr) return { ok: false, error: membersErr.message };

  // Fire-and-forget: notify every non-author member that they earned the
  // Verified contributor badge.
  void (async () => {
    try {
      const actor = await getActorDisplayInfo(user.id);
      if (!actor) return;
      const { data: members } = await admin
        .from("project_members")
        .select("user_id")
        .eq("project_id", input.projectId)
        .neq("user_id", user.id);
      for (const m of (members ?? []) as Array<{ user_id: string }>) {
        await createNotification({
          userId: m.user_id,
          kind: "project_accepted",
          actorName: actor.name,
          text: `${actor.name} marked your project delivered - you're now a Verified contributor`,
          href: `/c/${project.short_id as string}`,
        });
      }
    } catch { /* best-effort */ }
  })();

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Get projects where a user is a verified member (for portfolio page)
// ---------------------------------------------------------------------------

export async function getVerifiedProjectsForUser(userId: string) {
  if (!supabaseConfigured) return [];
  const sb = await getSupabaseServer();
  if (!sb) return [];

  const { data } = await sb
    .from("project_members")
    .select("role, project:projects!project_members_project_id_fkey(id,short_id,title,deliverable_url,delivered_at,author_id,author:profiles!projects_author_id_fkey(handle,name))")
    .eq("user_id", userId)
    .eq("is_verified", true);

  return data ?? [];
}
