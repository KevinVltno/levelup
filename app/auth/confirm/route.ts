import { z } from "zod"
import { NextResponse } from "next/server"
import { configured, supabase } from "@/lib/supabase"

const schema = z.object({ token_hash: z.string().min(1).max(512), type: z.literal("email") })

export async function GET(request: Request) {
  const url = new URL(request.url)
  const parsed = schema.safeParse({ token_hash: url.searchParams.get("token_hash"), type: url.searchParams.get("type") })
  if (parsed.success && configured()) {
    const db = await supabase()
    const { error } = await db.auth.verifyOtp(parsed.data)
    if (!error) return NextResponse.redirect(new URL("/", url))
  }
  return NextResponse.redirect(new URL("/masuk?verifikasi=gagal", url))
}
