import { timingSafeEqual } from "node:crypto"
import { sendNotification } from "web-push"
import { z } from "zod"
import { failure, logError, readBody } from "@/lib/http"
import { pushEndpoint } from "@/lib/push"
import { serviceClient } from "@/lib/supabase"

export const maxDuration = 60

type Reminder = { id: string; endpoint: string; p256dh: string; auth_key: string; habit_id: string; habit_name: string; reminder_day: string }

export async function POST(request: Request) {
  const secret = process.env.PUSH_CRON_SECRET
  const bearer = Buffer.from(request.headers.get("authorization") ?? "")
  const expected = Buffer.from("Bearer " + (secret ?? ""))
  if (!secret || bearer.length !== expected.length || !timingSafeEqual(bearer, expected)) return failure("Akses ditolak.", 401)
  if (!await readBody(request, z.strictObject({}))) return failure("Permintaan tidak valid.", 400)
  const { PUSH_PUBLIC_KEY, PUSH_PRIVATE_KEY, PUSH_SUBJECT, SUPABASE_SERVICE_ROLE_KEY } = process.env
  if (!PUSH_PUBLIC_KEY || !PUSH_PRIVATE_KEY || !PUSH_SUBJECT || !SUPABASE_SERVICE_ROLE_KEY) return failure("Push belum dikonfigurasi.", 503)
  const db = serviceClient()
  const { data, error } = await db.rpc("claim_push_reminders")
  if (error) { logError("push_claim", error); return failure("Pengingat belum bisa dimuat.", 503) }

  const rows = data as Reminder[]
  for (let i = 0; i < rows.length; i += 15) {
    await Promise.all(rows.slice(i, i + 15).map(async (row) => {
      let expired = !pushEndpoint.safeParse(row.endpoint).success
      if (!expired) {
        try {
          await sendNotification(
            { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } },
            JSON.stringify({ name: row.habit_name, tag: row.habit_id + "-" + row.reminder_day }),
            { vapidDetails: { subject: PUSH_SUBJECT, publicKey: PUSH_PUBLIC_KEY, privateKey: PUSH_PRIVATE_KEY }, TTL: 600, timeout: 6000 },
          )
        } catch (cause) {
          const status = (cause as { statusCode?: number }).statusCode
          expired = status === 404 || status === 410
          if (!expired) { console.error("push_delivery", status ?? "network"); return }
        }
      }
      const result = await db.rpc("finish_push_reminder", { p_id: row.id, p_expired: expired })
      if (result.error) logError("push_finish", result.error)
    }))
  }
  return Response.json({ processed: rows.length })
}
