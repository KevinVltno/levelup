"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BookOpen, Plus, Shield, Swords, Users, Zap } from "lucide-react"
import { Brand } from "./brand"
import { formatNumber } from "./progress"
import { type AdminData, type Pool, type Template, categories, difficulties, kinds, kindLabels } from "@/lib/model"
import { jsonRequest, messageOf } from "@/lib/client"
import type { Command } from "@/lib/validation"

export function AdminPanel({ data, userId }: { data: AdminData; userId: string }) {
  const [view, setView] = useState<"users" | "templates" | "pool">("users")
  const [entry, setEntry] = useState<Pool | Template | null>(null)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState("")
  const [busy, setBusy] = useState(false)
  const [search, setSearch] = useState("")
  const router = useRouter()

  async function run(command: Command) {
    setBusy(true)
    setNotice("")
    try {
      await jsonRequest("/api/commands", command)
      setEditing(false)
      setNotice("Perubahan tersimpan.")
      router.refresh()
    } catch (error) { setNotice(messageOf(error)) }
    finally { setBusy(false) }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const common = { id: entry?.id, name: String(values.get("name")), reward: Number(values.get("reward")), active: values.has("active") }
    const category = values.get("category") as Template["category"] | ""
    if (view === "templates" && category) void run({
      ...common, action: "saveTemplate", category, difficulty: values.get("difficulty") as Template["difficulty"], duration: Number(values.get("duration")),
    })
    if (view === "pool") void run({
      ...common, action: "savePool", category: category || null, kind: values.get("kind") as Pool["kind"], badge: String(values.get("badge")),
    })
  }

  const template = entry && "difficulty" in entry ? entry : undefined
  const pool = entry && "kind" in entry ? entry : undefined
  const entries = view === "templates" ? data.templates : data.pool
  const users = data.profiles.filter((profile) => profile.name.toLowerCase().includes(search.toLowerCase()))
  const stats = [
    { icon: Users, label: "Akun", value: data.stats.users },
    { icon: BookOpen, label: "Habit aktif", value: data.stats.habits },
    { icon: Swords, label: "Quest selesai", value: data.stats.quests },
    { icon: Zap, label: "Total XP", value: data.stats.xp },
  ]
  return <div className="admin-shell">
    <header className="admin-top"><Brand /><div><Link className="secondary" href="/#leaderboard">Leaderboard</Link> <Link className="secondary" href="/">Dashboard</Link></div></header>
    <main className="main-content">
      <div className="page-heading"><div><span className="eyebrow"><Shield size={15} /> ADMIN</span><h1>Panel admin</h1></div></div>
      <div className="summary-grid admin-summary">{stats.map(({icon: Icon, label, value}) => <section className="panel summary-card" key={label}><span className="category-icon blue"><Icon size={19} /></span><div><p>{label}</p><strong>{formatNumber(value)}</strong></div></section>)}</div>
      <div className="segmented admin-tabs">{([["users", "Pengguna"], ["templates", "Template habit"], ["pool", "Pool quest"]] as const).map(([id,label]) => <button key={id} className={view === id ? "selected" : ""} aria-pressed={view === id} onClick={() => { setView(id); setEditing(false); setNotice("") }}>{label}</button>)}</div>
      {notice && <p className="notice" role="status">{notice}</p>}
      {view === "users" ? <section className="panel admin-list">
        <div className="section-title"><h2>Pengguna</h2><input aria-label="Cari nama pengguna" placeholder="Cari nama…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {!users.length && <p className="empty">Pengguna tidak ditemukan.</p>}
        {users.map((profile) => <div className="history-row" key={profile.id}>
          <div><Link className="text-button" href={"/admin/pengguna/" + profile.id}>{profile.name}{profile.id === userId && " (kamu)"}</Link><p className="muted">Level {profile.level} · {profile.rank} · {formatNumber(profile.xp)} XP</p></div>
          <label className="sr-only" htmlFor={profile.id}>Peran {profile.name}</label>
          <select id={profile.id} value={profile.role} disabled={busy || profile.id === userId} onChange={(event) => {
            const role = event.target.value as "user" | "admin"
            if (window.confirm("Ubah peran " + profile.name + " menjadi " + role + "?")) void run({ action: "role", id: profile.id, role })
          }}><option value="user">User</option><option value="admin">Admin</option></select>
        </div>)}
      </section> : <div className={editing ? "content-grid" : "view-stack"}>
        <section className="panel admin-list"><div className="section-title"><h2>{view === "templates" ? "Template habit" : "Pool quest"}</h2><button className="primary" onClick={() => { setEntry(null); setEditing(true) }}><Plus size={17} /> Tambah</button></div>
          {!entries.length && <p className="empty">Belum ada entri.</p>}
          {entries.map((item) => <div className="history-row" key={item.id}><div><strong>{item.name}</strong><p className="muted">
            {"difficulty" in item ? item.difficulty + " · " + item.duration_minutes + " mnt" : kindLabels[item.kind]} · {item.xp_reward} XP · {item.active ? "Aktif" : "Nonaktif"}
          </p></div><button className="secondary" onClick={() => { setEntry(item); setEditing(true) }}>Edit</button></div>)}
        </section>
        {editing && <section className="panel admin-list"><div className="section-title"><h2>{entry ? "Edit entri" : "Entri baru"}</h2><button className="text-button" onClick={() => setEditing(false)}>Tutup</button></div>
          <form className="form-stack" onSubmit={submit} key={view + "-" + (entry?.id ?? "new")}>
            <label>Nama <input name="name" defaultValue={entry?.name} required maxLength={80} /></label>
            <label>Kategori <select name="category" defaultValue={entry?.category ?? ""}>{view === "pool" && <option value="">Semua kategori</option>}{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
            {view === "templates" ? <div className="form-pair"><label>Kesulitan <select name="difficulty" defaultValue={template?.difficulty}>{difficulties.map((d) => <option key={d}>{d}</option>)}</select></label><label>Durasi (menit) <input name="duration" type="number" min={1} max={180} defaultValue={template?.duration_minutes ?? 15} required /></label></div>
              : <div className="form-pair"><label>Periode <select name="kind" defaultValue={pool?.kind}>{kinds.map((k) => <option value={k} key={k}>{kindLabels[k]}</option>)}</select></label><label>Badge <select name="badge" defaultValue={pool?.badge_id} required>{data.badges.map((b) => <option value={b.id} key={b.id}>{b.name}</option>)}</select></label></div>}
            <label>Reward XP <input name="reward" type="number" min={1} max={500} defaultValue={entry?.xp_reward ?? 20} required /></label>
            <label className="check-label"><input type="checkbox" name="active" defaultChecked={entry?.active ?? true} /> Aktif</label>
            <button className="primary" disabled={busy}>Simpan</button>
          </form>
        </section>}
      </div>}
    </main>
  </div>
}
