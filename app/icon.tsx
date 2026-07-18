import { ImageResponse } from "next/og";

// Brand favicon: cobalt (saffron token) square with a white "C".
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2C5BFF",
          color: "#FFFFFF",
          fontSize: 44,
          fontWeight: 700,
          fontFamily: "system-ui, -apple-system, sans-serif",
          borderRadius: 12,
        }}
      >
        C
      </div>
    ),
    { ...size },
  );
}
