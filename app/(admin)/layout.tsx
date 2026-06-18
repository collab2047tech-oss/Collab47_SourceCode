import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const sb = await getSupabaseServer();
  if (sb) {
    const { data: { user } } = await sb.auth.getUser();
    const adminHandles = (process.env.ADMIN_HANDLES ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (!user) redirect("/login");
    if (adminHandles.length > 0) {
      const { data: profile } = await sb.from("profiles").select("handle").eq("id", user.id).maybeSingle();
      if (!profile || !adminHandles.includes(profile.handle.toLowerCase())) {
        redirect("/home");
      }
    }
  }
  return <div className="min-h-dvh bg-cream">{children}</div>;
}
