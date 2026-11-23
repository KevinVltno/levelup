"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity, Bell, CalendarDays, ChevronDown, ChevronsUp, CircleCheck, Flame, Gauge, LayoutDashboard, LogIn, LogOut,
  Menu, Plus, Shield, Sparkles, Swords, Target, Trophy, X, Zap,
} from "lucide-react"
import { Brand } from "./brand"
import { Chat } from "./chat"
import { disconnectPush, PushSettings } from "./push-settings"
import { HabitForm, Habits } from "./habits"
import { Leaderboard, Progress, ProgressChart, formatNumber } from "./progress"
import { QuestList, QuestTimer } from "./quests"
import { jsonRequest, messageOf } from "@/lib/client"
import { demoQuest } from "@/lib/demo"
import { type Dashboard, type Habit, type Quest, dayOfWeek, jakartaDay } from "@/lib/model"
import { commandSchema, type Command } from "@/lib/validation"

const sections = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "habit", label: "Habit", icon: Target },
  { id: "quest", label: "Quest", icon: Swords },
  { id: "progres", label: "Progres", icon: Activity },
  { id: "leaderboard", label: "Leaderboard", icon: Trophy },
  { id: "companion", label: "AI Companion", icon: Sparkles },
] as const
type View = typeof sections[number]["id"]
type Modal = "add" | "notices" | Quest["id"] | null
const demoKey = "levelup-demo-v1"

function demoLevel(data: Dashboard, xp: number) {
  const next = data.profile.xp + xp
  const level = Math.floor((1 + Math.sqrt(1 + next / 12.5)) / 2)
  const rank = level >= 75 ? "National Level" : level >= 50 ? "S" : level >= 35 ? "A" : level >= 20 ? "B" : level >= 10 ? "C" : level >= 5 ? "D" : "E"
  return { ...data.profile, xp: next, level, rank }
}

function updateDemo(data: Dashboard, command: Command) {
  const now = Date.now()
  let next = { ...data, serverTime: new Date(now).toISOString(), quests: data.quests.map((quest) => ({
    ...quest, remaining_seconds: Math.max(0, quest.remaining_seconds - (quest.status === "running" ? (now - Date.parse(data.serverTime)) / 1000 : 0)),
  })) }
  const habit = data.habits.find((item) => "id" in command && item.id === command.id)
  if (command.action === "custom" || command.action === "template") {
    const template = command.action === "template" ? data.templates.find((item) => item.id === command.id) : null
    if (command.action === "template" && !template) throw new Error("Template tidak tersedia.")
    const added: Habit = {
      id: crypto.randomUUID(), name: template?.name ?? (command.action === "custom" ? command.name : ""),
      category: template?.category ?? (command.action === "custom" ? command.category : "Discipline"),
      duration_minutes: template?.duration_minutes ?? (command.action === "custom" ? command.duration : 1),
      difficulty: template?.difficulty ?? null, xp_reward: template?.xp_reward ?? 0,
      is_custom: !template, weekdays: command.weekdays, reminder_at: command.reminder, streak: 0, missed: 0, archived_at: null,
    }
    next.habits = [...data.habits, added]
    next.quests = [...next.quests, demoQuest(added, data.today, next.quests.length)]
  } else if (command.action === "reminder" && habit) {
    next.habits = data.habits.map((item) => item.id === habit.id ? { ...item, reminder_at: command.reminder } : item)
  } else if (command.action === "archive" && habit) {
    next.habits = data.habits.map((item) => item.id === habit.id ? { ...item, archived_at: next.serverTime } : item)
    next.quests = next.quests.filter((quest) => quest.habit_id !== habit.id)
  } else if (command.action === "log" && habit) {
    if (data.logs.some((log) => log.habit_id === habit.id && log.log_date === data.today)) return next
    const used = data.logs.filter((log) => log.log_date === data.today && data.habits.some((h) => h.id === log.habit_id && h.is_custom)).reduce((sum, log) => sum + log.xp, 0)
    const duration = command.minutes ?? habit.duration_minutes
    const xp = habit.is_custom ? Math.min(duration * 2, Math.max(100 - used, 0)) : habit.xp_reward
    next.logs = [{ habit_id: habit.id, log_date: data.today, duration_minutes: duration, xp }, ...data.logs]
    next.habits = data.habits.map((item) => item.id === habit.id ? { ...item, streak: item.streak + 1 } : item)
    next.profile = demoLevel(next, xp)
  } else if (command.action === "quest") {
    const quest = next.quests.find((item) => item.id === command.id)
    if (quest && (quest.status === "running" || quest.status === "ready" || quest.status === "paused")) {
      if (quest.status === "running" && quest.remaining_seconds === 0) {
        quest.status = "completed"
        quest.completed_at = next.serverTime
        next.profile = demoLevel(next, quest.xp_reward)
        if (!next.badges.some((badge) => badge.id === quest.kind)) next = { ...next, badges: [...next.badges, { id: quest.kind, name: quest.kind === "weekly" ? "Ritme Konsisten" : "Penjelajah Gerbang" }] }
      } else if (command.control === "start" || command.control === "resume") {
        if (next.quests.some((item) => item.status === "running")) throw new Error("Jeda quest yang sedang berjalan.")
        quest.status = "running"
      } else if (command.control === "pause") quest.status = "paused"
      else if (command.control === "cancel") { quest.status = "ready"; quest.remaining_seconds = quest.duration_seconds }
    }
  }
  return next
}

function Hero({ data }: { data: Dashboard }) {
  const { rank, xp, level } = data.profile
  const base = 50 * level * (level - 1)
  const goal = level * 100
  const value = Math.max(0, xp - base)
  return <section className="hero">
    <div className="hero-copy">
      <span className="eyebrow"><Gauge size={15} /> PLAYER STATUS</span>
      <div className="hero-level"><span>LEVEL</span> {String(level).padStart(2, "0")}</div>
      <span className="rank-pill"><Shield size={15} /> {rank === "National Level" ? rank : "Rank " + rank}</span>
      <div className="hero-xp"><div className="line-label"><strong>Progres level</strong><span>{formatNumber(value)} / {formatNumber(goal)} XP</span></div>
      <div className="meter"><span style={{ width: Math.min(value / goal * 100, 100) + "%" }} /></div>
      <small>{formatNumber(Math.max(0, goal - value))} XP menuju Level {level + 1}</small></div>
    </div>
    <div className="hero-visual" aria-hidden="true"><div className="orb"><div className="orb-inner"><div className="orb-square"><div /></div><ChevronsUp strokeWidth={1.15} size={86} /></div></div></div>
  </section>
}

export function DashboardApp({ initialData, demo }: { initialData: Dashboard; demo: boolean }) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [view, setView] = useState<View>("dashboard")
  const [modal, setModal] = useState<Modal>(null)
  const [menu, setMenu] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delta, setDelta] = useState(0)
  const [toast, setToast] = useState("")
  const [modalError, setModalError] = useState("")
  const syncStart = useRef(0)
  const lock = useRef(false)
  const reminderKeys = useRef(new Set<string>())
  const dialog = useRef<HTMLDialogElement>(null)

  const replace = useCallback((next: Dashboard) => {
    syncStart.current = performance.now()
    setDelta(0)
    setData(next)
    if (demo) {
      try { localStorage.setItem(demoKey, JSON.stringify(next)) } catch { /* Browser storage unavailable. */ }
    }
  }, [demo])

  useEffect(() => {
    syncStart.current = performance.now()
    const handle = window.setTimeout(() => {
      const hash = window.location.hash.slice(1)
      if (sections.some((section) => section.id === hash)) setView(hash as View)
      if (demo) {
        try {
          const saved = localStorage.getItem(demoKey)
          if (saved) {
            const previous = JSON.parse(saved) as Dashboard
            if (previous.today === initialData.today) replace(updateDemo(previous, { action: "quest", id: previous.quests.find((q) => q.status === "running")?.id ?? "", control: "finish" }))
          }
        } catch { /* A new demo can start without browser storage. */ }
      }
    }, 0)
    const navigate = () => {
      const hash = window.location.hash.slice(1)
      setView(sections.find((section) => section.id === hash)?.id ?? "dashboard")
    }
    window.addEventListener("hashchange", navigate)
    return () => { window.clearTimeout(handle); window.removeEventListener("hashchange", navigate) }
  }, [demo, initialData.today, replace])

  useEffect(() => {
    const tick = window.setInterval(() => setDelta((performance.now() - syncStart.current) / 1000), 250)
    return () => window.clearInterval(tick)
  }, [])

  const refresh = useCallback(async () => {
    if (demo || lock.current || document.visibilityState !== "visible") return
    lock.current = true
    try {
      const next = await jsonRequest<Dashboard>("/api/dashboard")
      if (next.quests.some((quest) => quest.status === "completed" && data.quests.some((old) => old.id === quest.id && old.status !== "completed"))) {
        setToast("[SYSTEM] Quest Completed")
      }
      replace(next)
    } catch { /* Preserve the last snapshot during a background refresh. */ }
    finally { lock.current = false }
  }, [demo, data.quests, replace])

  useEffect(() => {
    if (demo) return
    const timer = window.setInterval(() => void refresh(), 30000)
    const visibility = () => { if (document.visibilityState === "visible") void refresh() }
    document.addEventListener("visibilitychange", visibility)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visibility) }
  }, [demo, refresh])

  const execute = useCallback(async (command: Command) => {
    if (lock.current) return false
    const parsed = commandSchema.safeParse(command)
    if (demo ? (command.action === "log" && command.minutes !== null && (command.minutes < 1 || command.minutes > 180)) : !parsed.success) {
      setModalError("Periksa input dan pastikan durasi antara 1–180 menit.")
      setToast("Periksa input dan pastikan durasi antara 1–180 menit.")
      return false
    }
    lock.current = true
    setBusy(true)
    setModalError("")
    try {
      let next: Dashboard
      let loggedXP: number | undefined
      if (demo) next = updateDemo(data, command)
      else {
        const result = await jsonRequest<{ data: unknown }>("/api/commands", command)
        if (command.action === "log" && typeof result.data === "number") loggedXP = result.data
        next = await jsonRequest<Dashboard>("/api/dashboard")
      }
      replace(next)
      const completed = next.quests.some((quest) => quest.status === "completed" && data.quests.some((old) => old.id === quest.id && old.status !== "completed"))
      const levelUp = next.profile.level > data.profile.level ? "[SYSTEM] Level Up! Level " + next.profile.level : ""
      if (completed) setToast("[SYSTEM] Quest Completed · XP dan badge diterima" + (levelUp ? " · " + levelUp : ""))
      else if (levelUp) setToast(levelUp)
      else if (command.action === "log") setToast("Habit tercatat · +" + (loggedXP ?? next.profile.xp - data.profile.xp) + " XP")
      else if (command.action === "custom" || command.action === "template") { setToast("Habit ditambahkan"); setModal(null) }
      else if (command.action === "archive") setToast("Habit diarsipkan")
      else if (command.action === "reminder") setToast("Pengingat diperbarui")
      return true
    } catch (error) {
      setModalError(messageOf(error))
      setToast(messageOf(error))
      return false
    } finally { lock.current = false; setBusy(false) }
  }, [data, demo, replace])

  const running = data.quests.find((quest) => quest.status === "running")
  const readyToFinish = Boolean(running && delta >= running.remaining_seconds)
  useEffect(() => {
    if (!running || !readyToFinish) return
    const timer = window.setInterval(() => void execute({ action: "quest", id: running.id, control: "finish" }), 1000)
    return () => window.clearInterval(timer)
  }, [running, readyToFinish, execute])

  const clock = Date.parse(data.serverTime) + delta * 1000
  const minute = Math.floor(clock / 60000)
  useEffect(() => {
    const date = new Date(minute * 60000)
    const today = jakartaDay(date)
    const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(date)
    const ready = data.habits.filter((habit) => !habit.archived_at && habit.reminder_at?.slice(0, 5) === time
      && habit.weekdays.includes(dayOfWeek(today)) && !data.logs.some((log) => log.habit_id === habit.id && log.log_date === today)
      && !reminderKeys.current.has(today + habit.id))
    if (!ready.length) return
    ready.forEach((habit) => reminderKeys.current.add(today + habit.id))
    const timer = window.setTimeout(() => setToast("Pengingat habit · " + ready.map((habit) => habit.name).join(", ")), 0)
    return () => window.clearTimeout(timer)
  }, [minute, data.habits, data.logs])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(""), 5500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (modal && !dialog.current?.open) dialog.current?.showModal()
    if (!modal && dialog.current?.open) dialog.current.close()
  }, [modal])

  function navigate(next: View) {
    setView(next)
    setMenu(false)
    window.history.pushState(null, "", "#" + next)
    window.scrollTo({ top: 0 })
  }
  function open(next: Modal) { setModalError(""); setModal(next) }
  async function signOut() {
    await disconnectPush().catch(() => undefined)
    try { await jsonRequest("/api/auth", { action: "logout" }); router.replace("/"); router.refresh() }
    catch (error) { setToast(messageOf(error)) }
  }

  const date = new Date(data.today + "T12:00:00+07:00")
  const dateText = new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(date)
  const habits = data.habits.filter((habit) => !habit.archived_at)
  const scheduled = habits.filter((habit) => habit.weekdays.includes(dayOfWeek(data.today)))
  const todayLogs = data.logs.filter((log) => log.log_date === data.today)
  const activeQuests = data.quests.filter((quest) => Date.parse(quest.expires_at) > Date.parse(data.serverTime))
  const allQuestRows = data.quests.filter((quest) => activeQuests.includes(quest) || quest.status === "failed")
  const selected = data.quests.find((quest) => quest.id === modal)
  const selectedSection = sections.find((item) => item.id === view)!
  const summary = [
    { name: "Habit hari ini", value: todayLogs.filter((log) => scheduled.some((habit) => habit.id === log.habit_id)).length + "/" + scheduled.length, icon: CircleCheck, tone: "mint", note: "Checklist selesai" },
    { name: "Streak terbaik", value: Math.max(0, ...habits.map((habit) => habit.streak)) + " hari", icon: Flame, tone: "gold", note: "Streak aktif terpanjang" },
    { name: "Total XP", value: formatNumber(data.profile.xp), icon: Zap, tone: "blue", note: "XP keseluruhan" },
  ]

  return <div className="app-shell">
    <aside className={"sidebar " + (menu ? "mobile-open" : "")}>
      <Brand />
      <div className="sidebar-body"><nav aria-label="Navigasi utama">
        {sections.map(({ icon: Icon, id, label }) => <button key={id} className={view === id ? "nav-link active" : "nav-link"} aria-current={view === id ? "page" : undefined} onClick={() => navigate(id)}><Icon size={19} /><span>{label}</span></button>)}
        {data.profile.role === "admin" && <Link className="nav-link" href="/admin"><Shield size={19} /> Panel admin</Link>}
      </nav></div>
      <div className="sidebar-bottom">{demo ? <Link className="nav-link" href="/masuk"><LogIn size={19} /> Masuk / Daftar</Link> : <button className="nav-link" onClick={() => void signOut()}><LogOut size={19} /> Keluar</button>}
        <div className="user-card"><span className="avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span><div><strong>{data.profile.name}</strong><small>{demo ? "Mode demo" : "Rank " + data.profile.rank}</small></div></div>
      </div>
    </aside>
    {menu && <button className="mobile-backdrop" aria-label="Tutup navigasi" onClick={() => setMenu(false)} />}
    <div className="workspace">
      <header className="topbar">
        <div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Buka navigasi" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={22} /></button><span>System</span><ChevronDown className="breadcrumb-divider" size={13} /><strong>{selectedSection.label}</strong></div>
        <div className="top-actions"><button className="icon-button bell" aria-label="Notifikasi" title="Notifikasi" onClick={() => open("notices")}><Bell size={19} />{(data.penalty > 0 || activeQuests.some((q) => q.status === "completed")) && <i />}</button><span className="avatar top-avatar">{data.profile.name.slice(0, 1).toUpperCase()}</span></div>
      </header>
      <main className="main-content" id="main-content">
        {view === "dashboard" ? <>
          <div className="page-heading"><div><div className="eyebrow date-line"><CalendarDays size={14} /> {dateText}</div><h1>Halo, {data.profile.name}.</h1><p className="muted">Naik level, sedikit demi sedikit, setiap hari.</p></div>
            <button className="primary" onClick={() => open("add")}><Plus size={18} /> Tambah habit</button></div>
          <Hero data={data} />
          <div className="summary-grid">{summary.map(({ icon: Icon, name, value, note, tone }) => <section className="panel summary-card" key={name}><span className={"category-icon " + tone}><Icon size={19} /></span><div><p>{name}</p><strong>{value}</strong><small>{note}</small></div></section>)}</div>
          <div className="content-grid home-grid"><Habits data={data} run={execute} busy={busy} expanded={false} onAdd={() => open("add")} /><QuestList quests={activeQuests} delta={delta} expanded={false} busy={busy} onQuest={(q) => open(q.id)} onView={() => navigate("quest")} /></div>
          <ProgressChart data={data} />
        </> : <>
          <div className="page-heading"><div><h1>{selectedSection.label}</h1></div></div>
          {view === "habit" && <Habits data={data} run={execute} busy={busy} expanded onAdd={() => open("add")} />}
          {view === "quest" && <QuestList quests={allQuestRows} delta={delta} expanded busy={busy} onQuest={(q) => open(q.id)} onView={() => undefined} />}
          {view === "progres" && <Progress data={data} />}
          {view === "leaderboard" && <Leaderboard data={data} />}
          {view === "companion" && <Chat demo={demo} />}
        </>}
      </main>
    </div>
    {toast && <div className={"toast " + (toast.includes("Level Up") ? "level-up" : "")} role="status"><Zap size={17} /> {toast}<button className="icon-button" onClick={() => setToast("")} aria-label="Tutup notifikasi"><X size={16} /></button></div>}
    <dialog ref={dialog} aria-labelledby="modal-title" onClose={() => setModal(null)} onClick={(event) => { if (event.target === event.currentTarget) setModal(null) }}>
      {modal && <div className="modal-content">
        <div className="section-title"><h2 id="modal-title">{modal === "add" ? "Tambah habit" : modal === "notices" ? "Notifikasi" : "Timer quest"}</h2><button className="icon-button" aria-label="Tutup dialog" onClick={() => setModal(null)}><X size={21} /></button></div>
        {modal === "add" && <HabitForm data={data} run={execute} busy={busy} />}
        {modal === "notices" && <div className="notice-list">
          {!demo && <PushSettings />}
          {data.quests.filter((q) => q.status === "completed").map((q) => <p className="notice" key={q.id}>[SYSTEM] Quest Completed · {q.title} · +{q.xp_reward} XP</p>)}
          {data.penalty > 0 && <p className="notice">Penalty Zone · −{data.penalty} XP dalam tujuh hari terakhir</p>}
          {data.quests.every((q) => q.status !== "completed") && !data.penalty && <p className="muted">Belum ada notifikasi.</p>}
        </div>}
        {selected && <QuestTimer quest={selected} delta={delta} busy={busy} run={execute} />}
        {modalError && <p className="notice" role="alert">{modalError}</p>}
      </div>}
    </dialog>
  </div>
}
