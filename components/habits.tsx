"use client"

import { useState, type FormEvent } from "react"
import { Archive, BookOpen, Check, Clock3, Dumbbell, Flame, HeartPulse, Plus, Target } from "lucide-react"
import { type Dashboard, type Habit, type Template, categories, dayOfWeek, weekdays } from "@/lib/model"
import type { Command } from "@/lib/validation"

export const categoryIcons = { Strength: Dumbbell, Intelligence: BookOpen, Discipline: Target, Vitality: HeartPulse }
export const categoryLabels = { Strength: "Fisik", Intelligence: "Belajar", Discipline: "Fokus", Vitality: "Kesehatan" }
export const categoryStyles = { Strength: "pink", Intelligence: "blue", Discipline: "violet", Vitality: "mint" }
export type Execute = (command: Command) => Promise<boolean>

export function Habits({ data, run, busy, expanded, onAdd }: {
  data: Dashboard; run: Execute; busy: boolean; expanded: boolean; onAdd: () => void
}) {
  const [durations, setDurations] = useState<Record<string, number>>({})
  const list = data.habits.filter((habit) => !habit.archived_at && (expanded || habit.weekdays.includes(dayOfWeek(data.today))))
  return <section className="panel habit-panel">
    <div className="section-title"><div><h2>{expanded ? "Habit saya" : "Habit hari ini"}</h2><p className="muted">Bangun ritme, satu checklist setiap hari.</p></div><button className="secondary" onClick={onAdd}><Plus size={17} /> Tambah habit</button></div>
    {list.length === 0 && <div className="empty"><Target size={25} /><p>Belum ada habit {expanded ? "aktif" : "terjadwal hari ini"}.</p><button className="text-button" onClick={onAdd}>Tambahkan habit</button></div>}
    {list.map((habit) => {
      const Icon = categoryIcons[habit.category]
      const done = data.logs.some((item) => item.habit_id === habit.id && item.log_date === data.today)
      const scheduled = habit.weekdays.includes(dayOfWeek(data.today))
      return <div className="habit-row" key={habit.id}>
        <span className={"category-icon " + categoryStyles[habit.category]}><Icon size={18} /></span>
        <div className="grow"><strong>{habit.name}</strong><div className="habit-meta">
          <span>{categoryLabels[habit.category]}</span><span><Clock3 size={13} /> {habit.duration_minutes} mnt</span>
          <span className="streak"><Flame size={14} /> {habit.streak}</span>
          {habit.difficulty && <span>{habit.difficulty}</span>}
          {expanded && habit.reminder_at && <span>{habit.reminder_at.slice(0,5)} WIB</span>}
        </div>{expanded && <><small className="muted">{weekdays.filter((_, i) => habit.weekdays.includes(i + 1)).join(" · ")}</small>
          <details className="habit-reminder"><summary>{habit.reminder_at ? "Ubah pengingat" : "Setel pengingat"}</summary>
            <form className="form-stack" key={habit.reminder_at ?? "none"} onSubmit={async (event) => {
              event.preventDefault()
              const form = event.currentTarget
              const reminder = String(new FormData(form).get("reminder") || "") || null
              if (await run({ action: "reminder", id: habit.id, reminder })) form.closest("details")?.removeAttribute("open")
            }}>
              <label>Jam WIB <input name="reminder" type="time" defaultValue={habit.reminder_at?.slice(0,5)} /></label>
              <button className="secondary" disabled={busy}>Simpan</button>
            </form>
          </details></>}</div>
        {expanded && <button className="icon-button" title="Arsipkan habit" aria-label={"Arsipkan " + habit.name} disabled={busy} onClick={() => {
          if (window.confirm("Arsipkan habit ini? Riwayat tetap tersimpan.")) void run({ action: "archive", id: habit.id })
        }}><Archive size={17} /></button>}
        {!done && scheduled && habit.is_custom && <input className="minute-input" aria-label={"Durasi aktual " + habit.name + " dalam menit"} title="Durasi aktual (menit)" type="number" min={1} max={180}
          value={durations[habit.id] ?? habit.duration_minutes} onChange={(event) => setDurations({ ...durations, [habit.id]: event.target.valueAsNumber || 0 })} />}
        <button className={"check-button" + (done ? " checked" : "")} disabled={busy || done || !scheduled}
          aria-label={done ? habit.name + " selesai" : "Catat " + habit.name} title={scheduled ? "Catat selesai" : "Di luar jadwal"}
          onClick={() => void run({ action: "log", id: habit.id, minutes: habit.is_custom ? durations[habit.id] ?? habit.duration_minutes : null })}>{done && <Check size={17} />}</button>
      </div>
    })}
  </section>
}

function recommendationScore(template: Template, habits: Habit[]) {
  return habits.filter((habit) => habit.category === template.category)
    .reduce((score, habit) => score + 1 + habit.missed * 2, 0)
}

export function HabitForm({ data, run, busy }: { data: Dashboard; run: Execute; busy: boolean }) {
  const active = data.habits.filter((habit) => !habit.archived_at)
  const templates = data.templates.filter((t) => !active.some((h) => !h.is_custom && h.category === t.category && h.name === t.name))
    .sort((a,b) => recommendationScore(b, active) - recommendationScore(a, active))
  const groups = Array.from(new Map(templates.map((t) => [t.category + ":" + t.name, t])).entries())
  const [mode, setMode] = useState<"custom" | "template">(groups.length ? "template" : "custom")
  const [group, setGroup] = useState(groups[0]?.[0] ?? "")
  const [days, setDays] = useState([1, 2, 3, 4, 5, 6, 7])
  const choices = templates.filter((t) => t.category + ":" + t.name === group).sort((a,b) => a.duration_minutes - b.duration_minutes)
  const [choice, setChoice] = useState("")
  const chosen = choices.find((t) => t.id === choice) ?? choices[0]

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const schedule = { weekdays: days, reminder: String(values.get("reminder") || "") || null }
    if (mode === "template" && chosen) void run({ action: "template", id: chosen.id, ...schedule })
    if (mode === "custom") void run({
      action: "custom", name: String(values.get("name")), category: values.get("category") as Template["category"],
      duration: Number(values.get("duration")), ...schedule,
    })
  }

  return <><div className="segmented"><button className={mode === "template" ? "selected" : ""} onClick={() => setMode("template")}>Rekomendasi</button><button className={mode === "custom" ? "selected" : ""} onClick={() => setMode("custom")}>Custom</button></div>
    <form onSubmit={submit} className="form-stack">
      {mode === "template" ? groups.length ? <>
        <label>Template <select value={group} onChange={(event) => setGroup(event.target.value)}>{groups.map(([id,t]) => <option key={id} value={id}>{t.name} · {categoryLabels[t.category]}</option>)}</select></label>
        <label>Kesulitan <select value={chosen?.id ?? ""} onChange={(event) => setChoice(event.target.value)}>{choices.map((t) => <option value={t.id} key={t.id}>{t.difficulty} · {t.duration_minutes} menit · {t.xp_reward} XP</option>)}</select></label>
      </> : <p className="muted">Semua rekomendasi yang tersedia sudah kamu tambahkan.</p> : <>
        <label>Nama habit <input name="name" required maxLength={80} placeholder="Contoh: Jalan sore" /></label>
        <div className="form-pair"><label>Kategori <select name="category">{categories.map((category) => <option key={category} value={category}>{categoryLabels[category]}</option>)}</select></label>
        <label>Target (menit) <input name="duration" type="number" min={1} max={180} defaultValue={15} required /></label></div>
      </>}
      <fieldset><legend>Hari aktif</legend><div className="day-picker">{weekdays.map((day, i) => <label key={day}><input type="checkbox" checked={days.includes(i + 1)} onChange={() => setDays(days.includes(i + 1) ? days.filter((index) => index !== i + 1) : [...days, i + 1])} /><span>{day}</span></label>)}</div></fieldset>
      <label>Jam pengingat (WIB, opsional) <input name="reminder" type="time" /></label>
      <button className="primary" disabled={busy || !days.length || (mode === "template" && !chosen)}>Simpan habit</button>
    </form></>
}
