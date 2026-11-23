export const categories = ["Strength", "Intelligence", "Discipline", "Vitality"] as const
export const difficulties = ["Easy", "Medium", "Hard", "Extreme"] as const
export const kinds = ["daily", "weekly", "special"] as const
export const weekdays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]
export const kindLabels = { daily: "Harian", weekly: "Mingguan", special: "Spesial" }
export const tagline = "Naik level, sedikit demi sedikit, setiap hari."

export type Profile = { id: string; name: string; role: "user" | "admin"; xp: number; level: number; rank: string }
export type Template = {
  id: string; name: string; category: typeof categories[number]; difficulty: typeof difficulties[number]
  duration_minutes: number; xp_reward: number; active: boolean
}
export type Habit = Omit<Template, "difficulty" | "active"> & {
  difficulty: Template["difficulty"] | null; is_custom: boolean; weekdays: number[]
  reminder_at: string | null; streak: number; missed: number; archived_at: string | null
}
export type HabitLog = { habit_id: string; duration_minutes: number; log_date: string; xp: number }
export type Quest = {
  id: string; habit_id: string; title: string; kind: typeof kinds[number]
  status: "ready" | "running" | "paused" | "completed" | "failed"
  duration_seconds: number; xp_reward: number; expires_at: string; assigned_date: string
  remaining_seconds: number; completed_at: string | null
}
export type ChatMessage = { id: string; role: "user" | "assistant"; content: string }
export type Leader = { name: string; xp: number; level: number; rank: string }
export type Pool = { id: string; name: string; category: Template["category"] | null; kind: Quest["kind"]; xp_reward: number; badge_id: string; active: boolean }
export type Dashboard = {
  profile: Profile; habits: Habit[]; logs: HabitLog[]; templates: Template[]; quests: Quest[]
  badges: { id: string; name: string }[]; weekly: Leader[]; overall: Leader[]
  serverTime: string; today: string; penalty: number
}
export type AdminData = {
  profiles: Profile[]; templates: Template[]; pool: Pool[]; badges: Dashboard["badges"]
  stats: { users: number; habits: number; quests: number; xp: number }
}

export function jakartaDay(date: Date) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Jakarta" }).format(date)
}

export function shiftDay(day: string, days: number) {
  const date = new Date(day + "T12:00:00Z")
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function dayOfWeek(day: string) {
  return new Date(day + "T12:00:00Z").getUTCDay() || 7
}
