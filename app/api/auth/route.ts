import { configured, supabase } from "@/lib/supabase"
import { failure, readBody } from "@/lib/http"
import { limitedLogin } from "@/lib/login-limit"
import { authSchema } from "@/lib/validation"

export async function POST(request: Request) {
  const body = await readBody(request, authSchema)
  if (!body) return failure("Periksa data formulir. Kata sandi akun baru minimal 8 karakter.", 400)
  if (!configured()) return failure("Supabase belum dikonfigurasi.", 503)
  const db = await supabase()
  if (body.action === "logout") {
    const { error } = await db.auth.signOut()
    return error ? failure("Gagal keluar. Coba kembali.", 400) : Response.json({ ok: true })
  }
  const { email, password } = body
  if (body.action === "login") {
    return limitedLogin(request, email, async () => {
      const { error } = await db.auth.signInWithPassword({ email, password })
      return error
    })
  }
  const { data, error } = await db.auth.signUp({ email, password, options: { data: { name: body.name } } })
  if (error) return failure("Pendaftaran belum berhasil. Periksa data atau coba beberapa saat lagi.", 400)
  return Response.json({ ok: true, verification: !data.session })
}
