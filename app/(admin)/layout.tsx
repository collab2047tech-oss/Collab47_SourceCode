import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();

  // If Supabase is not configured, deny access — never expose admin to unauthenticated requests.
  if (!sb) redirect("/home");

  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/home");

  const adminHandles = (process.env.ADMIN_HANDLES ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  // If no ADMIN_HANDLES env var is set, deny everyone (fail-closed).
  if (adminHandles.length === 0) redirect("/home");

  const { data: profile } = await sb
    .from("profiles")
    .select("handle")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !adminHandles.includes(profile.handle.toLowerCase())) {
    redirect("/home");
  }

  return <div className="min-h-dvh bg-cream">{children}</div>;
}
