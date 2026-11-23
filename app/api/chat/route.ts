import { ApiError } from "@google/genai"
import { streamCompanion } from "@/lib/gemini"
import { authenticated, failure, logError, readBody } from "@/lib/http"
import { chatMessagePageSize, chatPageSize } from "@/lib/model"
import { serviceClient } from "@/lib/supabase"
import { chatQuerySchema, chatSchema } from "@/lib/validation"

export const maxDuration = 60
const fallback = "Nara belum bisa menjawab saat ini. Coba lagi sebentar lagi."

export async function GET(request: Request) {
  const query = chatQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!query.success) return failure("Permintaan riwayat tidak valid.", 400)
  const session = await authenticated()
  if (!session) return failure("Masuk untuk membuka Nara.", 401)
  const { threadId, offset } = query.data
  const headers = { "Cache-Control": "private, no-store" }
  if (threadId) {
    const { data: thread, error: threadError } = await session.db.from("chat_threads").select("id").eq("id", threadId).maybeSingle()
    if (threadError) return failure("Percakapan belum dapat dimuat.", 503)
    if (!thread) return failure("Percakapan tidak tersedia.", 404)
    const { data, error } = await session.db.from("chat_messages").select("id,role,content").eq("thread_id", threadId)
      .order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + chatMessagePageSize)
    return error ? failure("Pesan belum dapat dimuat.", 503)
      : Response.json({ messages: data.slice(0, chatMessagePageSize).reverse(), more: data.length > chatMessagePageSize }, { headers })
  }
  const { data, error } = await session.db.from("chat_threads").select("id,title,updated_at").eq("user_id", session.id)
    .order("updated_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + chatPageSize)
  return error ? failure("Riwayat belum dapat dimuat.", 503)
    : Response.json({ threads: data.slice(0, chatPageSize), more: data.length > chatPageSize }, { headers })
}

export async function POST(request: Request) {
  const body = await readBody(request, chatSchema)
  if (!body) return failure("Tulis pesan sepanjang 1–2.000 karakter.", 400)
  const session = await authenticated()
  if (!session) return failure("Masuk untuk membuka Nara.", 401)
  if (!process.env.GEMINI_API_KEY || !process.env.GEMINI_MODEL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return failure(fallback, 503)

  const { db, id } = session
  const { threadId } = body
  const accepted = await db.rpc("accept_chat_message", { p_thread: threadId, p_content: body.message })
  if (accepted.error) {
    logError("accept_chat", accepted.error)
    if (accepted.error.code === "P0429") return failure(accepted.error.message, 429)
    if (accepted.error.code === "42501") return failure("Percakapan tidak tersedia.", 404)
    return failure(fallback, 503)
  }
  const synced = await db.rpc("sync_quests")
  if (synced.error) return failure(fallback, 503)
  const [history, profile, habits, quests] = await Promise.all([
    db.from("chat_messages").select("role,content").eq("user_id", id).eq("thread_id", threadId)
      .neq("id", accepted.data).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(12),
    db.from("profiles").select("level,rank").eq("id", id).single(),
    db.from("habits").select("name,category,streak").eq("user_id", id).is("archived_at", null).limit(12),
    db.from("user_quests").select("title,status").eq("user_id", id).gt("expires_at", synced.data).limit(10),
  ])
  const contents = (history.data ?? []).reverse().map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  }))
  contents.push({ role: "user", parts: [{ text: body.message }] })
  const encoder = new TextEncoder()
  const abort = AbortSignal.any([request.signal, AbortSignal.timeout(52000)])
  const service = serviceClient()
  return new Response(new ReadableStream({
    async start(controller) {
      let text = ""
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"))
      try {
        const stream = await streamCompanion(contents, { profile: profile.data, habits: habits.data, quests: quests.data }, abort)
        for await (const chunk of stream) {
          if (!chunk.text) continue
          text += chunk.text
          send({ text: chunk.text })
        }
        if (!text.trim()) throw new Error("Empty Gemini response")
        const saved = await service.from("chat_messages").insert({ user_id: id, thread_id: threadId, role: "assistant", content: text.slice(0, 12000) }).select("id").single()
        if (saved.error) {
          logError("nara_save_reply", saved.error)
          send({ error: "Balasan Nara belum tersimpan. Coba lagi sebentar lagi." })
          return
        }
        send({ done: true, messageId: saved.data.id })
      } catch (error) {
        if (request.signal.aborted) return
        const status = error instanceof ApiError ? error.status : undefined
        console.error("nara_gemini", status ?? (abort.aborted ? "timeout" : "stream_failed"))
        send({ error: status === 429 ? "Kuota Gemini sedang habis. Coba lagi setelah kuota tersedia." : fallback })
      } finally {
        controller.close()
      }
    },
  }), { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "private, no-store, no-transform", "X-Accel-Buffering": "no", "X-LevelUp-Message-Id": accepted.data } })
}
