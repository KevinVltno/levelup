"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Brand } from "./brand"
import { jsonRequest, messageOf } from "@/lib/client"
import { tagline } from "@/lib/model"

export function AuthForm({ enabled, badToken }: { enabled: boolean; badToken: boolean }) {
  const router = useRouter()
  const [register, setRegister] = useState(false)
  const [notice, setNotice] = useState(badToken ? "Tautan verifikasi kedaluwarsa atau tidak valid." : "")
  const [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    setBusy(true)
    setNotice("")
    try {
      const data = await jsonRequest<{ verification?: boolean }>("/api/auth", {
        action: register ? "register" : "login", ...Object.fromEntries(values),
      })
      if (data.verification) setNotice("Periksa email untuk mengaktifkan akun LevelUp.")
      else { router.replace("/"); router.refresh() }
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
      <label>Email <input name="email" type="email" autoComplete="email" required /></label>
      <label>Kata sandi <input name="password" type="password" autoComplete={register ? "new-password" : "current-password"} minLength={8} maxLength={72} required /></label>
      <button className="primary" disabled={busy || !enabled}>{busy ? "Memproses…" : register ? "Daftar" : "Masuk"}</button>
    </form>
    {notice && <p className="notice" role="status">{notice}</p>}
    <button className="text-button" onClick={() => { setRegister(!register); setNotice("") }}>{register ? "Sudah punya akun? Masuk" : "Belum punya akun? Daftar"}</button>
    <Link className="muted" href="/">Kembali ke dashboard</Link>
  </section></main>
}
