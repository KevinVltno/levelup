"use client"

import { useState } from "react"
import { Activity, CalendarDays, Medal, ShieldAlert, Trophy } from "lucide-react"
import { type Dashboard, categories, shiftDay } from "@/lib/model"
import { categoryIcons, categoryStyles } from "./habits"

export const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value)

export function ProgressChart({ data }: { data: Dashboard }) {
  const [period, setPeriod] = useState(7)
  const bucketCount = period === 7 ? 7 : 6
  const span = period / bucketCount
  const bars = Array.from({ length: bucketCount }, (_, i) => {
    const first = shiftDay(data.today, -(bucketCount - i) * span + 1)
    const last = shiftDay(first, span - 1)
    const value = data.logs.filter((log) => log.log_date >= first && log.log_date <= last).reduce((sum, log) => sum + log.xp, 0)
    const label = new Intl.DateTimeFormat("id-ID", period === 7 ? { weekday: "short", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(first + "T12:00:00Z"))
    return { first, last, value, label }
  })
  const max = Math.max(100, Math.ceil(Math.max(...bars.map((bar) => bar.value)) / 100) * 100)
  return <section className="panel chart-panel">
    <div className="section-title"><div><h2>Aktivitas XP</h2><p className="muted">XP yang diperoleh dari habit.</p></div>
      <div className="segmented compact" aria-label="Periode grafik"><button className={period === 7 ? "selected" : ""} aria-pressed={period === 7} onClick={() => setPeriod(7)}>7 hari</button><button className={period === 30 ? "selected" : ""} aria-pressed={period === 30} onClick={() => setPeriod(30)}>30 hari</button></div>
    </div>
    <div className="chart"><div className="chart-axis" aria-hidden="true"><span>{max}</span><span>{max * .75}</span><span>{max / 2}</span><span>{max / 4}</span><span>0</span></div>
      <div className="chart-content"><div className="chart-grid" />
        <div className="chart-columns">{bars.map((bar, i) => <div key={bar.first} className="chart-column">
          <div className="chart-track"><span className={i === bars.length - 1 ? "bar current" : "bar"} style={{ height: bar.value / max * 100 + "%" }} role="img" aria-label={bar.first + " sampai " + bar.last + ": " + bar.value + " XP"} title={bar.value + " XP"} /></div>
          <small>{bar.label}</small></div>)}</div>
      </div>
    </div>
  </section>
}

export function Progress({ data }: { data: Dashboard }) {
  const [page, setPage] = useState(0)
  const logs = [...data.logs].sort((a,b) => b.log_date.localeCompare(a.log_date))
  const points = categories.map((category) => data.logs.filter((log) => data.habits.find((habit) => habit.id === log.habit_id)?.category === category).reduce((sum, log) => sum + log.xp, 0))
  const max = Math.max(100, ...points)
  return <div className="view-stack">
    <div className="content-grid"><ProgressChart data={data} /><section className="panel stat-panel"><div className="section-title"><div><h2>Stat karakter</h2><p className="muted">XP dari tiap kategori habit.</p></div><Activity size={20} className="accent" /></div>
      {categories.map((category,i) => { const Icon = categoryIcons[category]; return <div className="stat-line" key={category}>
        <span className={"category-icon " + categoryStyles[category]}><Icon size={17} /></span><div className="grow"><div className="line-label"><strong>{category}</strong><span>{formatNumber(points[i])} XP</span></div><div className="meter"><span style={{ width: points[i] / max * 100 + "%" }} /></div></div>
      </div> })}
    </section></div>
    <div className="content-grid"><section className="panel history-panel"><div className="section-title"><h2>Riwayat habit</h2><CalendarDays size={19} className="accent" /></div>
      {!logs.length && <p className="muted">Checklist pertamamu akan muncul di sini.</p>}
      {logs.slice(page * 10, page * 10 + 10).map((entry) => <div className="history-row" key={entry.habit_id + entry.log_date}><div><strong>{data.habits.find((habit) => habit.id === entry.habit_id)?.name ?? "Habit"}</strong><p className="muted">{entry.log_date} · {entry.duration_minutes} menit</p></div><span className="accent">+{entry.xp} XP</span></div>)}
      {logs.length > 10 && <div className="pagination"><button className="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>Sebelumnya</button><button className="secondary" disabled={(page + 1) * 10 >= logs.length} onClick={() => setPage(page + 1)}>Selanjutnya</button></div>}
    </section><section className="panel stat-panel"><div className="section-title"><h2>Badge</h2><Medal size={20} className="accent" /></div>
      {data.badges.length ? data.badges.map((badge) => <div className="stat-line" key={badge.id}><span className="category-icon gold"><Medal size={17} /></span>{badge.name}</div>) : <p className="muted">Selesaikan quest untuk membuka badge.</p>}
      <div className="penalty"><ShieldAlert size={20} /><div><strong>Penalty Zone</strong><p className="muted">{data.penalty ? "−" + data.penalty + " XP dalam tujuh hari terakhir." : "Tidak ada penalti dalam tujuh hari terakhir."}</p></div></div>
    </section></div>
  </div>
}

export function Leaderboard({ data }: { data: Dashboard }) {
  const [weekly, setWeekly] = useState(true)
  const leaders = weekly ? data.weekly : data.overall
  return <section className="panel leaderboard"><div className="section-title"><div className="chat-title"><span className="category-icon gold"><Trophy size={19} /></span><div><h2>Leaderboard XP</h2><p className="muted">20 Hunter teratas</p></div></div><div className="segmented compact"><button aria-pressed={weekly} className={weekly ? "selected" : ""} onClick={() => setWeekly(true)}>Mingguan</button><button aria-pressed={!weekly} className={!weekly ? "selected" : ""} onClick={() => setWeekly(false)}>Total</button></div></div>
    {leaders.length ? <table><thead><tr><th>Posisi</th><th>Hunter</th><th>Rank</th><th>XP</th></tr></thead><tbody>{leaders.map((leader, i) => <tr key={i}><td>{i + 1}</td><td><strong>{leader.name}</strong><small>Level {leader.level}</small></td><td><span className="chip">{leader.rank}</span></td><td className="accent">{formatNumber(leader.xp)}</td></tr>)}</tbody></table> : <p className="empty">Belum ada XP untuk periode ini.</p>}
  </section>
}
