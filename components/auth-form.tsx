"use client"

import { useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Brand } from "./brand"
import { messageOf } from "@/lib/client"
import { tagline } from "@/lib/model"

const attemptStorageKey = "levelup-login-lock"
type Lock = { email: string; until: number }

function storeLock(lock: Lock | null) {
  try {
    if (lock) sessionStorage.setItem(attemptStorageKey, JSON.stringify(lock))
    else sessionStorage.removeItem(attemptStorageKey)
  } catch { /* The server still enforces the lock. */ }
}

export function AuthForm({ enabled, badToken }: { enabled: boolean; badToken: boolean }) {
  const router = useRouter()
  const [register, setRegister] = useState(false)
  const [notice, setNotice] = useState(badToken ? "Tautan verifikasi kedaluwarsa atau tidak valid." : "")
  const [busy, setBusy] = useState(false)
  const [email, setEmail] = useState("")
  const [lock, setLock] = useState<Lock | null>(null)
  const [seconds, setSeconds] = useState(0)
  const activeLock = !register && lock?.email === email.trim().toLowerCase() && seconds > 0

  useEffect(() => {
    const task = window.setTimeout(() => {
      try {
        const saved = JSON.parse(sessionStorage.getItem(attemptStorageKey) ?? "null") as Lock | null
        if (saved && typeof saved.email === "string" && Number.isFinite(saved.until) && saved.until > Date.now()) {
          setEmail((current) => current || saved.email)
          setLock(saved)
          setSeconds(Math.ceil((saved.until - Date.now()) / 1000))
        } else storeLock(null)
      } catch { /* Invalid or unavailable browser storage. */ }
    }, 0)
    return () => window.clearTimeout(task)
  }, [])

  useEffect(() => {
    if (!lock) return
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((lock.until - Date.now()) / 1000))
      setSeconds(left)
      if (!left) {
        setLock(null)
        storeLock(null)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [lock])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeLock || busy) return
    const values = new FormData(event.currentTarget)
    setBusy(true)
    setNotice("")
    try {
      const response = await fetch("/api/auth", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: register ? "register" : "login", ...Object.fromEntries(values) }),
      })
      const data = await response.json() as { verification?: boolean; error?: string; remaining?: number; retryAfter?: number }
      if (!response.ok) {
        if (!register && response.status === 429 && data.retryAfter && data.retryAfter > 0) {
          const nextLock = { email: String(values.get("email")).trim().toLowerCase(), until: Date.now() + data.retryAfter * 1000 }
          setLock(nextLock)
          setSeconds(data.retryAfter)
          storeLock(nextLock)
          if (data.remaining === 0) return
        }
        setNotice((data.error ?? "Terjadi kendala. Coba kembali.") + (data.remaining ? " Sisa percobaan: " + data.remaining + "." : ""))
        return
      }
      if (data.verification) setNotice("Periksa email untuk mengaktifkan akun LevelUp.")
      else {
        if (!register && lock?.email === email.trim().toLowerCase()) storeLock(null)
        router.replace("/")
        router.refresh()
      }
    } catch (error) { setNotice(messageOf(error)) }
    finally { setBusy(false) }
  }
  return <main className="auth-shell"><section className="panel auth-card">
    <Brand />
    <h1>{register ? "Buat akun" : "Masuk ke LevelUp"}</h1>
    <p className="muted">{tagline}</p>
    {!enabled && <p className="notice">Mode demo aktif. Sambungkan Supabase untuk mengaktifkan akun.</p>}
    <form onSubmit={submit} className="form-stack">
      {register && <label>Nama <input name="name" autoComplete="nickname" required maxLength={60} /></label>}
      <label>Email <input name="email" type="email" autoComplete="email" value={email} onChange={(event) => { setEmail(event.target.value); setNotice("") }} required /></label>
      <label>Kata sandi <input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={register ? 8 : 1} maxLength={72} required /></label>
      <button className="primary" disabled={busy || !enabled || activeLock}>{busy ? "Memproses…" : register ? "Daftar" : "Masuk"}</button>
    </form>
    {activeLock && <p className="notice">Coba masuk lagi dalam <span role="timer">{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>.</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <button className="text-button" onClick={() => { setRegister(!register); setNotice("") }}>{register ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}</button>
    <Link className="muted" href="/">Kembali ke dashboard</Link>
  </section></main>
}
