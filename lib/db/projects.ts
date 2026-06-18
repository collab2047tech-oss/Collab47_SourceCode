import { getSupabaseServer } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/env";

export interface MiniProfile {
  id: string;
  handle: string;
  name: string;
  avatar_url: string | null;
  college: string | null;
}

const MOCK_PROJECTS = [
  {
    id: "mock-proj-1",
    short_id: "anti-bias",
    author_id: "u1",
    title: "The Anti-Bias Hiring Lab",
    brief: "A coalition of Tier-2/3 student designers and engineers rebuilding the campus hiring stack from scratch.",
    deliverable: "Open-source scoring algorithm + public case study by 25 July.",
    deadline: "2026-07-25",
    slot_count: 5,
    status: "open" as const,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    author: { id: "u1", handle: "akshpreet", name: "Akshpreet Singh", avatar_url: null, college: "Thapar TIET" },
  },
  {
    id: "mock-proj-2",
    short_id: "crop-ai",
    author_id: "u2",
    title: "CropAI: Real-Time Disease Detector",
    brief: "Building an offline-capable ML model for detecting crop disease from smartphone photos. Targeting Punjab farmers.",
    deliverable: "Open-sourced model weights + Android demo app.",
    deadline: "2026-08-15",
    slot_count: 4,
    status: "open" as const,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    author: { id: "u2", handle: "arjun", name: "Arjun Mehta", avatar_url: null, college: "Punjabi University" },
  },
  {
    id: "mock-proj-3",
    short_id: "hindi-nlp",
    author_id: "u3",
    title: "Hindi NLP Corpus for Education",
    brief: "Annotating a 50k-sentence Hindi education corpus. Looking for NLP researchers and linguistics students.",
    deliverable: "Public dataset on HuggingFace + technical paper draft.",
    deadline: "2026-09-01",
    slot_count: 3,
    status: "open" as const,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    author: { id: "u3", handle: "priya", name: "Priya Joshi", avatar_url: null, college: "IIT Ropar" },
  },
];

export async function createProject(input: {
  title: string;
  brief: string;
  deliverable: string;
  deadline: string;
  slot_count: number;
}): Promise<{ ok: boolean; projectId?: string; shortId?: string; error?: string }> {
  if (!supabaseConfigured) {
    return { ok: true, projectId: "mock-proj-1", shortId: "anti-bias" };
  }
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true, projectId: "mock-proj-1", shortId: "anti-bias" };

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
  if (!sb) {
    return MOCK_PROJECTS.find((p) => p.short_id === shortId) ?? MOCK_PROJECTS[0];
  }

  const { data } = await sb
    .from("projects")
    .select("*, author:profiles!projects_author_id_fkey(id,handle,name,avatar_url,college)")
    .eq("short_id", shortId)
    .maybeSingle();

  return data ?? null;
}

export async function listOpenProjects(limit = 20) {
  const sb = await getSupabaseServer();
  if (!sb) return MOCK_PROJECTS;

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
  if (!supabaseConfigured) return { ok: true };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };

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
  if (!supabaseConfigured) return { ok: true };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };

  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error: updateErr } = await sb
    .from("project_applications")
    .update({ status: "accepted" })
    .eq("project_id", input.projectId)
    .eq("applicant_id", input.applicantId);

  if (updateErr) return { ok: false, error: updateErr.message };

  const { error: memberErr } = await sb
    .from("project_members")
    .upsert(
      { project_id: input.projectId, user_id: input.applicantId, role: "member" },
      { onConflict: "project_id,user_id" }
    );

  if (memberErr) return { ok: false, error: memberErr.message };

  const { data: existingConv } = await sb
    .from("conversations")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("type", "group")
    .maybeSingle();

  if (!existingConv) {
    const { data: newConv, error: convErr } = await sb
      .from("conversations")
      .insert({ type: "group", project_id: input.projectId })
      .select("id")
      .single();

    if (convErr || !newConv) return { ok: false, error: convErr?.message ?? "Failed to create group conversation." };

    const { data: members } = await sb
      .from("project_members")
      .select("user_id")
      .eq("project_id", input.projectId);

    if (members && members.length > 0) {
      const convMembers = members.map((m: { user_id: string }) => ({
        conversation_id: newConv.id,
        user_id: m.user_id,
      }));
      await sb.from("conversation_members").upsert(convMembers, { onConflict: "conversation_id,user_id" });
    }
  } else {
    await sb
      .from("conversation_members")
      .upsert(
        { conversation_id: existingConv.id, user_id: input.applicantId },
        { onConflict: "conversation_id,user_id" }
      );
  }

  return { ok: true };
}

export async function rejectApplicant(input: {
  projectId: string;
  applicantId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!supabaseConfigured) return { ok: true };
  const sb = await getSupabaseServer();
  if (!sb) return { ok: true };

  const { error } = await sb
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
