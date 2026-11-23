import { authenticated, failure, readBody } from "@/lib/http"
import { pushSchema } from "@/lib/push"

export async function GET() {
  const session = await authenticated()
  if (!session) return failure("Masuk untuk mengaktifkan notifikasi.", 401)
  return Response.json({ key: process.env.PUSH_PUBLIC_KEY ?? null }, { headers: { "Cache-Control": "private, no-store" } })
}

export async function POST(request: Request) {
  const body = await readBody(request, pushSchema)
  if (!body) return failure("Langganan push ini tidak didukung.", 400)
  const session = await authenticated()
  if (!session) return failure("Masuk untuk mengatur notifikasi.", 401)
  const { db } = session
  if (body.action === "status") {
    const result = await db.rpc("get_push_state", { p_endpoint: body.endpoint })
    return result.error ? failure("Status notifikasi belum bisa dimuat.", 503) : Response.json({ enabled: result.data })
  }
  const result = body.action === "enable"
    ? await db.rpc("register_push", { p_endpoint: body.endpoint, p_p256dh: body.p256dh, p_auth: body.auth })
    : await db.rpc("remove_push", { p_endpoint: body.endpoint })
  if (result.error) return failure(result.error.code === "P0001" ? result.error.message : "Pengaturan notifikasi belum tersimpan.", 409)
  return Response.json({ ok: true })
}
