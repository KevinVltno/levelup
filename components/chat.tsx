"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Bot, Send, Sparkles } from "lucide-react"
import { jsonRequest, messageOf } from "@/lib/client"
import type { ChatMessage } from "@/lib/model"

export function Chat({ demo }: { demo: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(!demo)
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (demo) return
    let current = true
    void jsonRequest<ChatMessage[]>("/api/chat")
      .then((history) => { if (current) setMessages(history) })
      .catch((failure) => { if (current) setError(messageOf(failure)) })
      .finally(() => { if (current) setLoading(false) })
    return () => { current = false }
  }, [demo])

  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }) }, [messages, reply])

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()
    if (!message || demo || busy) return
    setBusy(true)
    setError("")
    setInput("")
    try {
      const result = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }),
      })
      if (!result.ok || !result.body) throw new Error((await result.json()).error)
      setMessages((history) => [...history, { id: crypto.randomUUID(), role: "user", content: message }])
      const reader = result.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      let response = ""
      let finished = false
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += chunk.value
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line) continue
            const item = JSON.parse(line) as { text?: string; error?: string; done?: boolean }
            if (item.error) throw new Error(item.error)
            if (item.text) { response += item.text; setReply(response) }
            if (item.done) finished = true
          }
        }
      } finally { reader.releaseLock() }
      if (!finished) throw new Error("Koneksi terputus. Coba kirim kembali.")
      setMessages((history) => [...history, { id: crypto.randomUUID(), role: "assistant", content: response }])
    } catch (failure) {
      setError(messageOf(failure))
      setInput(message)
    } finally {
      setReply("")
      setBusy(false)
    }
  }

  return <section className="panel chat-panel">
    <div className="section-title"><div className="chat-title"><span className="category-icon violet"><Sparkles size={19} /></span><div><h2>Nara</h2><p className="muted">AI Companion</p></div></div></div>
    <div className="chat-log" role="log" aria-live="polite">
      {loading ? <p className="muted">Memuat percakapan…</p> : <>
        <div className="bubble assistant"><Bot size={17} /> <span>Halo, Hunter. Lagi sulit memulai atau bingung mau fokus ke mana? Cerita saja, kita cari langkah kecilnya.</span></div>
        {messages.map((msg) => <p className={"bubble " + msg.role} key={msg.id}>{msg.content}</p>)}
        {busy && <p className="bubble assistant">{reply || "Nara sedang menyiapkan jawaban…"}</p>}
      </>}
      <div ref={bottom} />
    </div>
    {error && <p className="notice" role="alert">{error}</p>}
    {demo ? <Link className="primary" href="/masuk">Masuk untuk chat</Link> : <form onSubmit={send} className="chat-compose">
      <textarea aria-label="Pesan untuk Nara" placeholder="Tulis pesan untuk Nara…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} required />
      <button className="primary" aria-label="Kirim pesan" disabled={busy || loading || !input.trim()}><Send size={18} /></button>
    </form>}
    <small className="muted">Nara memakai Gemini untuk merespons chat dan konteks progresmu.</small>
  </section>
}
