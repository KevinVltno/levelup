import { type Dashboard, type Habit, type Quest, type Template, jakartaDay, shiftDay } from "./model"

type Draft = [string, Template["category"], number, number]
const sample: Draft[] = [
  ["Latihan fisik", "Strength", 20, 5],
  ["Membaca 10 halaman", "Intelligence", 15, 3],
  ["Sesi fokus", "Discipline", 25, 7],
  ["Meditasi", "Vitality", 10, 2],
]

export function demoQuest(habit: Habit, today: string, index: number): Quest {
  const kind = index < 3 ? "daily" : index === 3 ? "weekly" : "special"
  return {
    id: "quest-" + habit.id, habit_id: habit.id, title: habit.name, kind, status: "ready",
    assigned_date: today, expires_at: shiftDay(today, kind === "daily" ? 1 : 7) + "T00:00:00+07:00",
    duration_seconds: habit.duration_minutes * 60, remaining_seconds: habit.duration_minutes * 60,
    xp_reward: [40, 30, 50, 80, 100][index % 5], completed_at: null,
  }
}

export function demoDashboard(now: Date): Dashboard {
  const today = jakartaDay(now)
  const habits: Habit[] = sample.map(([name, category, duration_minutes, streak], index) => ({
    id: String(index), name, category, duration_minutes, streak,
    xp_reward: index === 2 ? 45 : 20, difficulty: index === 2 ? "Medium" : null, is_custom: index !== 2,
    weekdays: [1, 2, 3, 4, 5, 6, 7], reminder_at: null, missed: 0, archived_at: null,
  }))
  const templates: Template[] = sample.flatMap(([name, category], index) => ([
    ["Easy", 10, 20], ["Medium", 25, 45], ["Hard", 45, 85], ["Extreme", 60, 120],
  ] as const).map(([difficulty, duration_minutes, xp_reward]) => ({
    id: index + "-" + difficulty, name, category, difficulty, duration_minutes, xp_reward, active: true,
  })))
  const logs = Array.from({ length: 24 }, (_, i) => ({
    habit_id: String(i % 4), log_date: shiftDay(today, -Math.floor(i / 4) - 1),
    xp: [20, 30, 40, 15, 25][(i * 3 + Math.floor(i / 4)) % 5],
    duration_minutes: 12 + (i % 4) * 5,
  })).filter((_, i) => ![5, 7, 9, 14, 17, 19, 21, 22].includes(i))
  logs.unshift({ habit_id: "1", log_date: today, xp: 30, duration_minutes: 15 })
  return {
    profile: { id: "demo", name: "Hunter", role: "user", xp: 3400, level: 8, rank: "D" },
    habits, templates, logs, quests: habits.map((habit, index) => demoQuest(habit, today, index)),
    badges: [{ id: "daily", name: "Langkah Pertama" }], penalty: 0, today, serverTime: now.toISOString(),
    weekly: [
      { name: "Aster", xp: 540, level: 14, rank: "C" }, { name: "Rin", xp: 425, level: 11, rank: "C" },
      { name: "Sora", xp: 380, level: 9, rank: "D" }, { name: "Hunter", xp: 295, level: 8, rank: "D" },
    ],
    overall: [
      { name: "Aster", xp: 9250, level: 14, rank: "C" }, { name: "Rin", xp: 5900, level: 11, rank: "C" },
      { name: "Sora", xp: 3910, level: 9, rank: "D" }, { name: "Hunter", xp: 3400, level: 8, rank: "D" },
    ],
  }
}
