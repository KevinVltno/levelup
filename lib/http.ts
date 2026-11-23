import { type z } from "zod"
import { configured, supabase } from "./supabase"

export function failure(message: string, status: number) {
  return Response.json({ error: message }, { status })
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) return null
  try {
    const value = schema.safeParse(await request.json())
    return value.success ? value.data : null
  } catch {
    return null
  }
}

export async function authenticated() {
  if (!configured()) return null
  const db = await supabase()
  const { data } = await db.auth.getClaims()
  return data?.claims.sub ? { db, id: data.claims.sub } : null
}

export function logError(label: string, error: { code?: string }) {
  console.error(label, error.code || "unknown")
}
