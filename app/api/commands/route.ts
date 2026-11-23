import { authenticated, failure, logError, readBody } from "@/lib/http"
import { commandSchema } from "@/lib/validation"

export async function POST(request: Request) {
  const body = await readBody(request, commandSchema)
  if (!body) return failure("Periksa input dan coba kembali.", 400)
  const session = await authenticated()
  if (!session) return failure("Masuk kembali untuk melanjutkan.", 401)
  const { db } = session
  let result
  switch (body.action) {
    case "custom":
    case "template":
      result = await db.rpc("add_habit", {
        p_template: body.action === "template" ? body.id : null,
        p_name: body.action === "custom" ? body.name : null,
        p_category: body.action === "custom" ? body.category : null,
        p_duration: body.action === "custom" ? body.duration : null,
        p_weekdays: body.weekdays,
        p_reminder: body.reminder,
      })
      break
    case "archive":
      result = await db.rpc("archive_habit", { p_id: body.id })
      break
    case "reminder":
      result = await db.rpc("set_habit_reminder", { p_id: body.id, p_reminder: body.reminder })
      break
    case "log":
      result = await db.rpc("log_habit", { p_id: body.id, p_minutes: body.minutes })
      break
    case "quest":
      result = await db.rpc("quest_action", { p_id: body.id, p_action: body.control })
      break
    default: {
      const admin = await db.rpc("is_admin")
      if (!admin.data) return failure("Akses admin diperlukan.", 403)
      if (body.action === "role") {
        result = await db.rpc("admin_role", { p_id: body.id, p_role: body.role })
      } else if (body.action === "saveTemplate") {
        const values = { name: body.name, category: body.category, difficulty: body.difficulty, duration_minutes: body.duration, xp_reward: body.reward, active: body.active }
        const table = db.from("habit_templates")
        result = await (body.id ? table.update(values).eq("id", body.id) : table.insert(values)).select("id").single()
      } else {
        const values = { name: body.name, category: body.category, kind: body.kind, xp_reward: body.reward, badge_id: body.badge, active: body.active }
        const table = db.from("quest_pool")
        result = await (body.id ? table.update(values).eq("id", body.id) : table.insert(values)).select("id").single()
      }
    }
  }
  if (result.error) {
    logError(body.action, result.error)
    if (result.error.code === "P0001") return failure(result.error.message, 409)
    if (result.error.code === "23505") return failure("Data yang sama sudah ada.", 409)
    return failure("Perubahan belum tersimpan. Coba kembali.", 400)
  }
  return Response.json({ data: result.data })
}
