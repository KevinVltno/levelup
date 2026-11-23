import "server-only"
import { createHmac } from "node:crypto"
import { isIP } from "node:net"
import type { AuthError } from "@supabase/supabase-js"
import { failure, logError } from "./http"
import { serviceClient } from "./supabase"

type AttemptResult = { reservation?: string; retry_after?: number | null; remaining?: number; pending?: boolean }

function loginBucket(request: Request, email: string, secret: string) {
  const forwarded = process.env.VERCEL === "1" ? request.headers.get("x-vercel-forwarded-for")?.trim() : undefined
  const address = forwarded && isIP(forwarded) ? forwarded.toLowerCase() : "unavailable"
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).update("\0").update(address).digest("hex")
}

function waitResponse(seconds: number, pending = false) {
  return Response.json({
    error: pending ? "Percobaan lain masih diproses. Tunggu sebentar." : "Batas percobaan masuk tercapai.",
    retryAfter: seconds,
    ...(pending ? {} : { remaining: 0 }),
  }, { status: 429, headers: { "Retry-After": String(seconds), "Cache-Control": "no-store" } })
}

export async function limitedLogin(request: Request, email: string, authenticate: () => Promise<AuthError | null>) {
  const secret = process.env.LOGIN_LIMIT_SECRET
  if (!secret || !process.env.SUPABASE_SERVICE_ROLE_KEY) return failure("Layanan masuk belum tersedia.", 503)
  const db = serviceClient()
  const bucket = loginBucket(request, email, secret)
  const start = await db.rpc("begin_login", { p_bucket: bucket })
  if (start.error) {
    logError("begin_login", start.error)
    return failure("Layanan masuk belum tersedia. Coba kembali.", 503)
  }
  const attempt = start.data as AttemptResult
  if (attempt.retry_after) return waitResponse(attempt.retry_after)
  if (attempt.pending) return waitResponse(5, true)
  if (!attempt.reservation) return failure("Layanan masuk belum tersedia.", 503)

  let error: AuthError | null
  try {
    error = await authenticate()
  } catch {
    await db.rpc("finish_login", { p_bucket: bucket, p_reservation: attempt.reservation, p_result: "ignore" })
    return failure("Layanan masuk belum tersedia. Coba kembali.", 503)
  }
  const invalid = error?.code === "invalid_credentials" || error?.code === "email_not_confirmed"
  const result = await db.rpc("finish_login", {
    p_bucket: bucket,
    p_reservation: attempt.reservation,
    p_result: !error ? "success" : invalid ? "failure" : "ignore",
  })
  if (result.error) logError("finish_login", result.error)
  if (!error) return Response.json({ ok: true })
  if (!invalid) {
    if (error.status === 429) return waitResponse(60, true)
    return failure("Layanan masuk belum tersedia. Coba kembali.", 503)
  }
  if (result.error) return failure("Percobaan masuk belum bisa dicatat. Coba kembali.", 503)
  const outcome = result.data as AttemptResult
  if (outcome.retry_after) return waitResponse(outcome.retry_after)
  return Response.json({
    error: "Email atau kata sandi salah, atau email belum terverifikasi.",
    remaining: outcome.remaining,
  }, { status: 401, headers: { "Cache-Control": "no-store" } })
}
