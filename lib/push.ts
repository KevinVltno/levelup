import { z } from "zod"

export const pushEndpoint = z.url().max(2048).refine((value) => {
  const url = new URL(value)
  return url.protocol === "https:" && !url.port && !url.username && !url.password && !url.hash
    && (["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"].includes(url.hostname)
      || /^[a-z0-9-]+\.notify\.windows\.com$/.test(url.hostname)
      || /^[a-z0-9-]+\.web\.push\.apple\.com$/.test(url.hostname))
}, "Layanan push browser belum didukung.")

export const pushSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("enable"), endpoint: pushEndpoint, p256dh: z.string().regex(/^[\w-]{87}$/), auth: z.string().regex(/^[\w-]{22}$/) }),
  z.object({ action: z.literal("disable"), endpoint: z.string().max(2048) }),
  z.object({ action: z.literal("status"), endpoint: z.string().max(2048) }),
])
