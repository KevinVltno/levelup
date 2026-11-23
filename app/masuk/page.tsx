import { Suspense } from "react"
import { redirect } from "next/navigation"
import { authenticated } from "@/lib/http"
import { configured } from "@/lib/supabase"
import { AuthForm } from "@/components/auth-form"
import { LoadingScreen } from "@/components/loading"

export const metadata = { title: "Masuk" }

type Props = { searchParams: Promise<{ verifikasi?: string }> }

async function LoginForm({ searchParams }: Props) {
  if (await authenticated()) redirect("/")
  return <AuthForm enabled={configured()} badToken={(await searchParams).verifikasi === "gagal"} />
}

export default function Login(props: Props) {
  return <Suspense fallback={<LoadingScreen />}><LoginForm {...props} /></Suspense>
}
