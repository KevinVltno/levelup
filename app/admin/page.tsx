import { Suspense } from "react"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { authenticated } from "@/lib/http"
import { loadAdmin } from "@/lib/data"
import { AdminPanel } from "@/components/admin"
import { LoadingScreen } from "@/components/loading"

export const metadata = { title: "Panel admin" }

async function AdminContent() {
  await connection()
  const session = await authenticated()
  if (!session) redirect("/masuk")
  const { data, error } = await session.db.rpc("is_admin")
  if (error || !data) redirect("/")
  return <AdminPanel data={await loadAdmin(session.db)} userId={session.id} />
}

export default function AdminPage() {
  return <Suspense fallback={<LoadingScreen />}><AdminContent /></Suspense>
}
