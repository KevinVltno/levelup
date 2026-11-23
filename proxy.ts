import { createServerClient } from "@supabase/ssr"
import { NextRequest, NextResponse } from "next/server"

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  let response = NextResponse.next({ request })
  if (!url || !key) return response
  const db = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([name, value]) => response.headers.set(name, value))
      },
    },
  })
  const { data } = await db.auth.getClaims()
  if (request.nextUrl.pathname.startsWith("/admin")) {
    const id = data?.claims.sub
    const { data: profile } = id
      ? await db.from("profiles").select("role").eq("id", id).maybeSingle()
      : { data: null }
    if (profile?.role !== "admin") {
      const redirect = NextResponse.redirect(new URL(id ? "/" : "/masuk", request.url))
      response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
      return redirect
    }
  }
  return response
}

export const config = { matcher: ["/", "/masuk", "/admin/:path*", "/api/:path*"] }
