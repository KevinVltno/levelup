"use client"

import Link from "next/link"

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="auth-shell"><section className="panel auth-card">
    <h1>Data belum dapat dimuat</h1>
    <p className="muted">Coba lagi dalam beberapa saat atau masuk kembali.</p>
    <button className="primary" onClick={reset}>Coba lagi</button>
    <Link href="/masuk">Ke halaman masuk</Link>
  </section></main>
}
