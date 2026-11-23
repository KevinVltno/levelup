import { loadDashboard } from "@/lib/data"
import { authenticated, failure } from "@/lib/http"

export async function GET() {
  const session = await authenticated()
  if (!session) return failure("Masuk kembali untuk melanjutkan.", 401)
  try {
    return Response.json(await loadDashboard(session.db, session.id), { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("Dashboard", error instanceof Error ? error.message : "unknown")
    return failure("Data LevelUp belum dapat dimuat.", 503)
  }
}
