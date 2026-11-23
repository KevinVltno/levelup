import { Suspense } from "react"
import { connection } from "next/server"
import { DashboardApp } from "@/components/dashboard"
import { demoDashboard } from "@/lib/demo"
import { authenticated } from "@/lib/http"
import { loadDashboard } from "@/lib/data"
import { LoadingScreen } from "@/components/loading"

async function Dashboard() {
  await connection()
  const session = await authenticated()
  const data = session ? await loadDashboard(session.db, session.id) : demoDashboard(new Date())
  return <DashboardApp key={data.profile.id} initialData={data} demo={!session} />
}

export default function Home() {
  return <Suspense fallback={<LoadingScreen />}><Dashboard /></Suspense>
}
