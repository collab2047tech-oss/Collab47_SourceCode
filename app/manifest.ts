import type { MetadataRoute } from "next";

// Colors mirror app/globals.css design tokens:
//   background = --color-cream (#F5F7FB), theme = --color-saffron (#2C5BFF).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Collab47",
    short_name: "Collab47",
    description: "India's unified academia-industry collaboration ecosystem.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7FB",
    theme_color: "#2C5BFF",
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
