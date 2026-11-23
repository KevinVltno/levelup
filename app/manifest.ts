import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "LevelUp", short_name: "LevelUp", lang: "id", start_url: "/", scope: "/",
    display: "standalone", background_color: "#090d18", theme_color: "#090d18",
    icons: [
      { src: "/levelup-192.png", sizes: "192x192", type: "image/png" },
      { src: "/levelup-512.png", sizes: "512x512", type: "image/png" },
    ],
  }
}
