import "server-only"
import type { SupabaseClient } from "@supabase/supabase-js"
import { type AdminData, type Dashboard, type Quest, jakartaDay, shiftDay } from "./model"

function checked<T>(result: { data: T | null; error: { code: string } | null }): T {
  if (result.error || result.data === null) throw new Error(result.error?.code ?? "Missing data")
  return result.data
}

export async function loadDashboard(db: SupabaseClient, id: string): Promise<Dashboard> {
  const serverTime: string = checked(await db.rpc("sync_quests"))
  const today = jakartaDay(new Date(serverTime))
  const [p, h, l, t, q, b, w, a, penalty] = await Promise.all([
    db.from("profiles").select("id,name,role,xp,level,rank").eq("id", id).single(),
    db.from("habits").select("*").eq("user_id", id).order("created_at"),
    db.from("habit_logs").select("habit_id,duration_minutes,log_date,xp").eq("user_id", id).order("log_date",{ascending:false}).limit(10000),
    db.from("habit_templates").select("*").eq("active", true).order("name"),
    db.from("user_quests").select("*").eq("user_id", id).gte("expires_at", new Date(Date.parse(serverTime) - 86400000).toISOString()).order("assigned_date", { ascending: false }),
    db.from("user_badges").select("badges(id,name)").eq("user_id", id),
    db.rpc("leaderboard", { p_weekly: true }),
    db.rpc("leaderboard", { p_weekly: false }),
    db.from("xp_events").select("amount").eq("user_id", id).lt("amount", 0).gte("created_at", shiftDay(today, -6) + "T00:00:00+07:00"),
  ])
  const quests = checked(q).map((row): Quest => {
    const since = row.status === "running" ? (Date.parse(serverTime) - Date.parse(row.running_since)) / 1000 : 0
    return { ...row, remaining_seconds: row.status === "completed" ? 0 : Math.max(0, row.duration_seconds - row.elapsed_seconds - since) }
  })
  return {
    profile: checked(p), habits: checked(h), logs: checked(l), templates: checked(t), quests,
    badges: (checked(b) as unknown as { badges: Dashboard["badges"][number] }[]).map((row) => row.badges),
    weekly: checked(w), overall: checked(a), serverTime, today,
    penalty: checked(penalty).reduce((sum, row) => sum - row.amount, 0),
  }
}

export async function loadAdmin(db: SupabaseClient): Promise<AdminData> {
  const [profiles, templates, pool, badges, stats] = await Promise.all([
    db.from("profiles").select("id,name,role,xp,level,rank").order("created_at", { ascending: false }),
    db.from("habit_templates").select("*").order("name"),
    db.from("quest_pool").select("*").order("name"),
    db.from("badges").select("id,name").order("name"),
    db.rpc("admin_stats"),
  ])
  return { profiles: checked(profiles), templates: checked(templates), pool: checked(pool), badges: checked(badges), stats: checked(stats) }
}
