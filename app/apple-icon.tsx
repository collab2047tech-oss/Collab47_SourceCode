import { ImageResponse } from "next/og";

// Apple touch icon: cobalt (saffron token) rounded square with a white "C".
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#B95402",
          color: "#FFFFFF",
          fontSize: 118,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
