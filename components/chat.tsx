"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Bot, History, Plus, Send, Sparkles, WifiOff } from "lucide-react"
import { jsonRequest, messageOf } from "@/lib/client"
import { chatMessagePageSize, chatPageSize, type ChatMessage, type ChatThread } from "@/lib/model"

type ThreadPage = { threads: ChatThread[]; more: boolean }
type MessagePage = { messages: ChatMessage[]; more: boolean }

export function markNewChat(userId: string, pending: boolean) {
  try {
    const key = "levelup-nara-new-" + userId
    if (pending) localStorage.setItem(key, "1")
    else localStorage.removeItem(key)
  } catch { /* The active tab still keeps its connection state. */ }
}

function hasNewChat(userId: string) {
  try { return localStorage.getItem("levelup-nara-new-" + userId) === "1" }
  catch { return false }
}

function threadUrl(id: string, offset = 0) {
  return "/api/chat?threadId=" + encodeURIComponent(id) + "&offset=" + offset
}

export function Chat({ demo, userId, offline, reconnected, onConversationStarted }: {
  demo: boolean; userId: string; offline: boolean; reconnected: boolean; onConversationStarted: () => void
}) {
  const [startFresh] = useState(reconnected)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [reply, setReply] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(!demo)
  const [moreThreads, setMoreThreads] = useState(false)
  const [moreMessages, setMoreMessages] = useState(false)
  const [threadOffset, setThreadOffset] = useState(0)
  const [messageOffset, setMessageOffset] = useState(0)
  const [reload, setReload] = useState(0)
  const [failed, setFailed] = useState(false)
  const log = useRef<HTMLDivElement>(null)
  const scrollToEnd = useRef(true)
  const streamAbort = useRef<AbortController | null>(null)

  useEffect(() => {
    if (demo || offline) return
    let current = true
    async function load() {
      try {
        const page = await jsonRequest<ThreadPage>("/api/chat")
        if (!current) return
        setThreads(page.threads)
        setMoreThreads(page.more)
        setThreadOffset(chatPageSize)
        const latest = page.threads[0]
        if (latest && !startFresh && !hasNewChat(userId)) {
          setSelected(latest.id)
          const history = await jsonRequest<MessagePage>(threadUrl(latest.id))
          if (!current) return
          setMessages(history.messages)
          setMoreMessages(history.more)
          setMessageOffset(chatMessagePageSize)
        }
      } catch (failure) {
        if (current) { setError(messageOf(failure)); setFailed(true) }
      } finally {
        if (current) setLoading(false)
      }
    }
    void load()
    return () => { current = false }
  }, [demo, offline, startFresh, reload, userId])

  useEffect(() => () => streamAbort.current?.abort(), [])

  useEffect(() => {
    if (scrollToEnd.current && log.current) log.current.scrollTop = log.current.scrollHeight
  }, [messages, reply])

  function newChat() {
    markNewChat(userId, true)
    scrollToEnd.current = true
    setSelected(null)
    setMessages([])
    setMoreMessages(false)
    setMessageOffset(0)
    setInput("")
    setError("")
  }

  async function openThread(id: string) {
    setLoading(true)
    setError("")
    try {
      const page = await jsonRequest<MessagePage>(threadUrl(id))
      scrollToEnd.current = true
      setSelected(id)
      setMessages(page.messages)
      setMoreMessages(page.more)
      setMessageOffset(chatMessagePageSize)
      setInput("")
      setFailed(false)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setLoading(false) }
  }

  async function loadEarlier() {
    if (!selected) return
    setLoading(true)
    setError("")
    try {
      const page = await jsonRequest<MessagePage>(threadUrl(selected, messageOffset))
      scrollToEnd.current = false
      setMessages((current) => [...page.messages.filter((message) => !current.some((item) => item.id === message.id)), ...current])
      setMoreMessages(page.more)
      setMessageOffset(messageOffset + chatMessagePageSize)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setLoading(false) }
  }

  async function loadOlderThreads() {
    setLoading(true)
    setError("")
    try {
      const page = await jsonRequest<ThreadPage>("/api/chat?offset=" + threadOffset)
      setThreads((current) => [...current, ...page.threads.filter((thread) => !current.some((item) => item.id === thread.id))])
      setMoreThreads(page.more)
      setThreadOffset(threadOffset + chatPageSize)
    } catch (failure) { setError(messageOf(failure)) }
    finally { setLoading(false) }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = input.trim()
    if (!message || demo || offline || busy || loading || failed || streamAbort.current) return
    const threadId = selected ?? crypto.randomUUID()
    const controller = new AbortController()
    streamAbort.current = controller
    scrollToEnd.current = true
    setBusy(true)
    setError("")
    setInput("")
    try {
      const result = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, threadId }), signal: controller.signal,
      })
      if (!result.ok || !result.body) throw new Error((await result.json()).error)
      setSelected(threadId)
      markNewChat(userId, false)
      onConversationStarted()
      setThreads((current) => {
        const existing = current.find((item) => item.id === threadId)
        const thread = { id: threadId, title: existing?.title ?? message.replace(/\s+/g, " ").slice(0, 80), updated_at: new Date().toISOString() }
        return [thread, ...current.filter((item) => item.id !== threadId)]
      })
      if (!selected) setThreadOffset((current) => current + 1)
      setMessageOffset((current) => current + 1)
      setMessages((history) => [...history, { id: result.headers.get("X-LevelUp-Message-Id") ?? crypto.randomUUID(), role: "user", content: message }])
      const reader = result.body.pipeThrough(new TextDecoderStream()).getReader()
      let buffer = ""
      let response = ""
      let assistantId: string | undefined
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          buffer += chunk.value
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            if (!line) continue
            const item = JSON.parse(line) as { text?: string; error?: string; done?: boolean; messageId?: string }
            if (item.error) throw new Error(item.error)
            if (item.text) { response += item.text; setReply(response) }
            if (item.done) assistantId = item.messageId
          }
        }
      } finally { reader.releaseLock() }
      if (!assistantId) throw new Error("Koneksi terputus. Kamu bisa membuka kembali percakapan dari riwayat.")
      setMessages((history) => [...history, { id: assistantId, role: "assistant", content: response }])
      setMessageOffset((current) => current + 1)
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(messageOf(failure))
        setInput(message)
      }
    } finally {
      streamAbort.current = null
      setReply("")
      setBusy(false)
    }
  }

  const currentTitle = threads.find((thread) => thread.id === selected)?.title ?? "Chat baru"
  return <div className={demo ? "chat-workspace demo" : "chat-workspace"}>
    {!demo && <aside className="panel chat-history" aria-label="Riwayat percakapan">
      <div className="section-title"><h2><History size={17} /> Riwayat</h2><button className="secondary" disabled={busy || loading} onClick={newChat}><Plus size={16} /> Chat baru</button></div>
      {threads.length ? <div className="chat-thread-list">{threads.map((thread) => <button key={thread.id} className={thread.id === selected ? "chat-thread active" : "chat-thread"}
        aria-current={thread.id === selected ? "true" : undefined} disabled={offline || busy || loading} onClick={() => void openThread(thread.id)}>{thread.title}</button>)}</div>
        : <p className="muted">{loading && !offline ? "Memuat riwayat…" : "Belum ada percakapan."}</p>}
      {moreThreads && <button className="text-button" disabled={offline || busy || loading} onClick={() => void loadOlderThreads()}>Riwayat lainnya</button>}
    </aside>}
    <section className="panel chat-panel">
      <div className="section-title"><div className="chat-title"><span className="category-icon violet"><Sparkles size={19} /></span><div className="grow"><h2>Nara</h2><p className="muted">{demo ? "AI Companion" : currentTitle}</p></div></div></div>
      {offline && <p className="notice chat-offline" role="status"><WifiOff size={16} /> Kamu sedang offline. Chat baru akan terbuka saat koneksi kembali.</p>}
      {!offline && !selected && reconnected && <p className="notice chat-offline" role="status">Koneksi kembali. Chat baru siap.</p>}
      <div className="chat-log" role="log" aria-live="polite" ref={log}>
        {moreMessages && <button className="text-button" disabled={offline || busy || loading} onClick={() => void loadEarlier()}>Muat pesan sebelumnya</button>}
        {loading && !messages.length && !offline ? <p className="muted">Memuat percakapan…</p> : <>
          {messages.length === 0 && <div className="bubble assistant"><Bot size={17} /> <span>Halo, Hunter. Lagi sulit memulai atau bingung mau fokus ke mana? Cerita saja, kita cari langkah kecilnya.</span></div>}
          {messages.map((msg) => <p className={"bubble " + msg.role} key={msg.id}>{msg.content}</p>)}
          {busy && <p className="bubble assistant">{reply || "Nara sedang menyiapkan jawaban…"}</p>}
        </>}
      </div>
      {error && <p className="notice" role="alert">{error}</p>}
      {failed && <button className="secondary" disabled={offline || loading} onClick={() => { setFailed(false); setError(""); setLoading(true); setReload(reload + 1) }}>Muat ulang riwayat</button>}
      {demo ? <Link className="primary" href="/masuk">Masuk untuk chat</Link> : <form onSubmit={send} className="chat-compose">
        <textarea aria-label="Pesan untuk Nara" placeholder="Tulis pesan untuk Nara…" value={input} onChange={(event) => setInput(event.target.value)} maxLength={2000} required />
        <button className="primary" aria-label="Kirim pesan" disabled={offline || busy || loading || failed || !input.trim()}><Send size={18} /></button>
      </form>}
      <small className="muted">Nara memakai Gemini untuk merespons chat dan konteks progresmu.</small>
    </section>
  </div>
}
