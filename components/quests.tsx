"use client"

import { useState } from "react"
import { Check, Clock3, Crosshair, Pause, Play, Swords, X } from "lucide-react"
import { type Quest, kindLabels, kinds } from "@/lib/model"
import type { Execute } from "./habits"

export function timeLabel(seconds: number) {
  const total = Math.max(0, Math.ceil(seconds))
  return [Math.floor(total / 60), total % 60].map((value) => String(value).padStart(2, "0")).join(":")
}

const statusLabels = { ready: "Siap", running: "Berjalan", paused: "Dijeda", completed: "Selesai", failed: "Gagal" }

export function QuestList({ quests, delta, expanded, busy, onQuest, onView }: {
  quests: Quest[]; delta: number; expanded: boolean; busy: boolean; onQuest: (quest: Quest) => void; onView: () => void
}) {
  const [tab, setTab] = useState<Quest["kind"]>("daily")
  const current = quests.filter((quest) => quest.kind === (expanded ? tab : "daily"))
  const completed = current.filter((quest) => quest.status === "completed").length
  return <section className="panel quest-panel">
    <div className="section-title"><div className="chat-title"><span className="category-icon blue"><Swords size={18} /></span><div><h2>{expanded ? "Dungeon Gate" : "Quest Harian"}</h2><p className="muted">{completed}/{current.length} selesai</p></div></div>
      {!expanded && <button className="text-button" onClick={onView}>Lihat semua</button>}
    </div>
    {expanded && <div className="segmented quest-tabs">{kinds.map((kind) => <button key={kind} aria-pressed={tab === kind} className={tab === kind ? "selected" : ""} onClick={() => setTab(kind)}>{kindLabels[kind]}</button>)}</div>}
    {!current.length && <div className="empty"><Crosshair size={25} /><p>Belum ada quest {kindLabels[expanded ? tab : "daily"].toLowerCase()} untuk habit aktifmu.</p></div>}
    {current.map((quest) => {
      const active = quest.status === "running"
      const done = quest.status === "completed"
      const label = active || quest.status === "paused" ? timeLabel(quest.remaining_seconds - (active ? delta : 0)) : quest.duration_seconds / 60 + " mnt"
      return <button className={"quest-row " + (active ? "running" : "")} key={quest.id} onClick={() => onQuest(quest)} disabled={busy}>
        <span className={done ? "quest-symbol success" : "quest-symbol"}>{done ? <Check size={17} /> : <Crosshair size={17} />}</span>
        <span className="grow"><strong>{quest.title}</strong><small><Clock3 size={13} /> {label}{quest.status !== "ready" && " · " + statusLabels[quest.status]}</small></span>
        <span className="xp-tag">+{quest.xp_reward} XP</span>
      </button>
    })}
  </section>
}

export function QuestTimer({ quest, delta, busy, run }: { quest: Quest; delta: number; busy: boolean; run: Execute }) {
  const remaining = Math.max(0, quest.remaining_seconds - (quest.status === "running" ? delta : 0))
  const actions = quest.status === "running" || quest.status === "paused"
  const control = quest.status === "ready" ? "start" : quest.status === "running" ? "pause" : "resume"
  const labels = { start: "Mulai quest", pause: "Jeda", resume: "Lanjutkan" }
  return <div className="timer-view">
    <span className="eyebrow"><Crosshair size={15} /> DUNGEON GATE · {kindLabels[quest.kind].toUpperCase()}</span>
    <h3>{quest.title}</h3>
    <div className="timer-ring" style={{ "--fill": (1 - remaining / quest.duration_seconds) * 360 + "deg" } as React.CSSProperties}>
      <div><strong>{timeLabel(remaining)}</strong><span>{statusLabels[quest.status]}</span></div>
    </div>
    <p className="muted">+{quest.xp_reward} XP · Badge quest</p>
    <p className="muted">Batas waktu {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(quest.expires_at))} WIB</p>
    {(actions || quest.status === "ready") && <div className="timer-actions">
      <button className="primary" disabled={busy || (quest.status === "running" && remaining === 0)} onClick={() => void run({ action: "quest", id: quest.id, control })}>{control === "pause" ? <Pause size={17} /> : <Play size={17} />} {labels[control]}</button>
      {actions && <button className="secondary" disabled={busy} onClick={() => void run({ action: "quest", id: quest.id, control: "cancel" })}><X size={17} /> Batalkan timer</button>}
    </div>}
  </div>
}
