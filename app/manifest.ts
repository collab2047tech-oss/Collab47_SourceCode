import type { MetadataRoute } from "next";

// Colors mirror app/globals.css design tokens:
//   background = --color-cream (#FBF8F4), theme = --color-saffron (#B95402).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collab47",
    short_name: "Collab47",
    description: "India's unified academia-industry collaboration ecosystem.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F4",
    theme_color: "#B95402",
    icons: [
      {
        src: "/icon",
        sizes: "64x64",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
