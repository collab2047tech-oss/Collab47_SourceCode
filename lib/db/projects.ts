import { getSupabaseServer } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createNotification, getActorDisplayInfo } from "@/lib/db/notifications";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

export async function createProject(input: {
  title: string;
  brief: string;
  deliverable: string;
  deadline: string;
  slot_count: number;
}): Promise<{ ok: boolean; projectId?: string; shortId?: string; error?: string }> {
  const sb = await getSupabaseServer();
  if (!sb) return { ok: false, error: "Database not connected." };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: project, error: insertErr } = await sb
    .from("projects")
    .insert({
      title: input.title,
      brief: input.brief,
      deliverable: input.deliverable,
      deadline: input.deadline,
      slot_count: input.slot_count,
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

/**
 * Discovery listing with status filter + optional text search.
 *  - "open"      -> status = 'open' (accepting applications)
 *  - "forming"   -> team_formed / in_progress (team assembled, work underway)
 *  - "delivered" -> shipped projects (portfolio-grade outcomes)
 *  - "all"       -> everything, newest first
 * Each row is annotated with `member_count` so callers can render open slots.
 */
export async function listProjects(opts: {
  filter?: ProjectListFilter;
  search?: string;
  limit?: number;
} = {}) {
  const { filter = "open", search, limit = 24 } = opts;
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

  const { error } = await sb.from("project_applications").insert({
    project_id: input.projectId,
    applicant_id: user.id,
    pitch: input.pitch,
    links: input.links,
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
