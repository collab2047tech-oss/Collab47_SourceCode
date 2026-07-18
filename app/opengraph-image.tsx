import { ImageResponse } from "next/og";

// Default site-wide social share card.
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Collab47";

export default async function OpengraphImage() {
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
          padding: "80px",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Accent rule */}
        <div
          style={{
            display: "flex",
            width: 96,
            height: 8,
            background: "#B95402",
            borderRadius: 999,
          }}
        />

        {/* Wordmark + tagline */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 128,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              color: "#12100E",
            }}
          >
            Collab
            <span style={{ color: "#B95402" }}>47</span>
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 40,
              fontWeight: 500,
              color: "#6B6559",
              maxWidth: 900,
              lineHeight: 1.3,
            }}
          >
            Where talent, innovation and opportunity converge.
          </div>
        </div>

        {/* Footer domain */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontWeight: 600,
            color: "#12100E",
          }}
        >
          collab47.com
        </div>
      </div>
    ),
    { ...size },
  );
}
