import { ImageResponse } from "next/og";
import { getAdminClient } from "@/lib/supabase/admin";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Collab47 post";
export const runtime = "nodejs";

// Branded per-post share card: author + an excerpt of the post. Rendered when a
// /p/[short_id] link is shared. Real data via the service client.
export default async function Image({ params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;

  let author = "Collab47";
  let handle = "";
  let avatar: string | null = null;
  let excerpt = "";

  const admin = getAdminClient();
  if (admin) {
    const { data } = await admin
      .from("posts")
      .select("body, author:profiles!posts_author_id_fkey(name, handle, avatar_url)")
      .eq("short_id", short_id)
      .maybeSingle();
    if (data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const a = data.author as any;
      author = a?.name || "Someone";
      handle = a?.handle ? `@${a.handle}` : "";
      avatar = a?.avatar_url || null;
      excerpt = ((data.body as string) || "").slice(0, 180);
    }
  }

  const initials = author
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
          background: "#FBF8F4",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} width={84} height={84} style={{ width: 84, height: 84, borderRadius: 84, objectFit: "cover" }} alt="" />
          ) : (
            <div
              style={{
                width: 84,
                height: 84,
                borderRadius: 84,
                background: "#B95402",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
                fontWeight: 800,
              }}
            >
              {initials || "C"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", marginLeft: 24 }}>
            <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "#12100E" }}>{author}</div>
            {handle ? <div style={{ display: "flex", fontSize: 26, color: "#8A93A6" }}>{handle}</div> : null}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 48, lineHeight: 1.3, color: "#12100E", fontWeight: 500 }}>
          {excerpt}
          {excerpt.length >= 180 ? "..." : ""}
        </div>

        <div style={{ display: "flex", alignItems: "center", fontSize: 30, fontWeight: 800, color: "#12100E" }}>
          Collab<span style={{ color: "#B95402" }}>47</span>
        </div>
      </div>
    ),
    size,
  );
}
