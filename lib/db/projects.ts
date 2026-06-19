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
    .select("*, author:profiles!projects_author_id_fkey(id,handle,name,avatar_url,college)")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
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
    .select("author_id")
    .eq("id", input.projectId)
    .maybeSingle();

  if (project?.author_id === user.id) {
    return { ok: false, error: "Authors cannot apply to their own project." };
  }

  if (input.pitch.length > 800) {
    return { ok: false, error: "Pitch must be 800 characters or fewer." };
  }

  if (input.links.length > 3) {
    return { ok: false, error: "You can attach at most 3 links." };
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
    .select("author_id, short_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can accept applicants." };

  // Privileged writes (membership + conversation management) via service role.
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  // Enforce 5-member cap (owner counts).
  const { count: memberCount } = await admin
    .from("project_members")
    .select("user_id", { count: "exact", head: true })
    .eq("project_id", input.projectId);
  if ((memberCount ?? 0) >= 5) {
    return { ok: false, error: "This project already has the maximum of 5 members." };
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
    .select("author_id")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can reject applicants." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  const { error } = await admin
    .from("project_applications")
    .update({ status: "rejected" })
    .eq("project_id", input.projectId)
    .eq("applicant_id", input.applicantId);

  if (error) return { ok: false, error: error.message };
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

  const { data: project } = await sb
    .from("projects")
    .select("author_id")
    .eq("id", input.projectId)
    .maybeSingle();

  if (!project) return { ok: false, error: "Project not found." };
  if (project.author_id !== user.id) return { ok: false, error: "Only the project author can mark it delivered." };

  const admin = getAdminClient();
  if (!admin) return { ok: false, error: "Server not configured." };

  const { error: projectErr } = await admin
    .from("projects")
    .update({
      delivered_at: new Date().toISOString(),
      deliverable_url: input.deliverableUrl,
      status: "delivered",
    })
    .eq("id", input.projectId);

  if (projectErr) return { ok: false, error: projectErr.message };

  const { error: membersErr } = await admin
    .from("project_members")
    .update({ is_verified: true })
    .eq("project_id", input.projectId);

  if (membersErr) return { ok: false, error: membersErr.message };

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
