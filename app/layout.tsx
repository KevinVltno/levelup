import type { Metadata } from "next"
import { tagline } from "@/lib/model"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: "LevelUp — System Dashboard", template: "%s | LevelUp" },
  description: tagline,
  icons: { icon: "/levelup.svg", apple: "/levelup-192.png" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>
}
