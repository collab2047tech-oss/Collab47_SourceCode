import { ImageResponse } from "next/og";
import { getAdminClient } from "@/lib/supabase/admin";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Collab47 profile";
export const runtime = "nodejs";

// Branded per-profile share card. Rendered when someone links a /u/[handle] page
// on LinkedIn / X / WhatsApp. Uses real profile data via the service client.
export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  let name = "Collab47";
  let sub = "collab47.com";
  let avatar: string | null = null;
  let verified = false;

  const admin = getAdminClient();
  if (admin) {
    const { data } = await admin
      .from("profiles")
      .select("name, handle, avatar_url, college, branch, verified")
      .ilike("handle", handle)
      .maybeSingle();
    if (data) {
      name = (data.name as string) || `@${handle}`;
      const where = (data.college as string) || (data.branch as string) || "";
      sub = `@${data.handle as string}${where ? `  ·  ${where}` : ""}`;
      avatar = (data.avatar_url as string) || null;
      verified = Boolean(data.verified);
    }
  }

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F5F7FB",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 800, color: "#0A0F1C" }}>
          Collab<span style={{ color: "#2C5BFF" }}>47</span>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              width={168}
              height={168}
              style={{ width: 168, height: 168, borderRadius: 168, objectFit: "cover", border: "4px solid #2C5BFF" }}
              alt=""
            />
          ) : (
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: 168,
                background: "#2C5BFF",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 64,
                fontWeight: 800,
              }}
            >
              {initials || "C"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 40 }}>
            <div style={{ display: "flex", alignItems: "center", fontSize: 66, fontWeight: 800, color: "#0A0F1C" }}>
              {name}
              {verified ? <span style={{ color: "#2C5BFF", marginLeft: 16, fontSize: 48 }}>✓</span> : null}
            </div>
            <div style={{ display: "flex", fontSize: 34, color: "#42506B", marginTop: 12 }}>{sub}</div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 28, color: "#8A93A6" }}>
          India&#39;s academia-industry collaboration network
        </div>
      </div>
    ),
    size,
  );
}
