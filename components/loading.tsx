import { Brand } from "./brand"

export function LoadingScreen() {
  return <main className="auth-shell"><section className="panel auth-card"><Brand /><p role="status" className="muted">Memuat LevelUp…</p></section></main>
}
