import { Suspense } from "react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { z } from "zod"
import { Brand } from "@/components/brand"
import { LoadingScreen } from "@/components/loading"
import { authenticated } from "@/lib/http"
import { type Habit, type Profile, weekdays } from "@/lib/model"

type Props = { params: Promise<{ id: string }> }
type Details = {
  profile: Profile
  habits: (Habit & { today_done: boolean; last_done: string | null; completion_count: number })[]
  logs: { habit_id: string; name: string; log_date: string; duration_minutes: number; xp: number }[]
}

async function UserDetails({ params }: Props) {
  const session = await authenticated()
  if (!session) redirect("/masuk")
  const { data: admin } = await session.db.rpc("is_admin")
  if (!admin) redirect("/")
  const id = z.uuid().safeParse((await params).id)
  if (!id.success) notFound()
  const { data, error } = await session.db.rpc("admin_user_habits", { p_id: id.data })
  if (error) throw new Error("Detail habit belum bisa dimuat.")
  if (!data) notFound()
  const { profile, habits, logs } = data as Details
  return <div className="admin-shell">
    <header className="admin-top"><Brand /><Link className="secondary" href="/admin">Daftar pengguna</Link></header>
    <main className="main-content">
      <div className="page-heading"><div><h1>{profile.name}</h1><p className="muted">{profile.role === "admin" ? "Admin" : "User"} · Level {profile.level} · Rank {profile.rank}</p></div></div>
      <section className="panel admin-list">
        <div className="section-title"><h2>Habit pengguna</h2><span className="muted">{habits.filter((habit) => !habit.archived_at).length} aktif</span></div>
        {!habits.length && <p className="empty">Pengguna ini belum membuat habit.</p>}
        {habits.map((habit) => <div className="history-row" key={habit.id}>
          <div><strong>{habit.name}</strong>
            <p className="muted">{habit.is_custom ? "Custom" : "Rekomendasi · " + habit.difficulty} · {habit.category} · {habit.duration_minutes} menit</p>
            <p className="muted">{weekdays.filter((_, index) => habit.weekdays.includes(index + 1)).join(" · ")}{habit.reminder_at && " · " + habit.reminder_at.slice(0,5) + " WIB"}</p>
            <p className="muted">{habit.completion_count} kali selesai · Streak {habit.streak}{habit.last_done && " · Terakhir " + habit.last_done}</p>
          </div><span className="chip">{habit.archived_at ? "Diarsipkan" : habit.today_done ? "Selesai hari ini" : "Aktif"}</span>
        </div>)}
      </section>
      <section className="panel admin-list">
        <div className="section-title"><h2>30 checklist terakhir</h2></div>
        {!logs.length && <p className="empty">Belum ada checklist yang tercatat.</p>}
        {logs.map((log) => <div className="history-row" key={log.habit_id + log.log_date}><div><strong>{log.name}</strong><p className="muted">{log.log_date} · {log.duration_minutes} menit</p></div><span className="accent">+{log.xp} XP</span></div>)}
      </section>
    </main>
  </div>
}

export default function AdminUserPage(props: Props) {
  return <Suspense fallback={<LoadingScreen />}><UserDetails {...props} /></Suspense>
}
