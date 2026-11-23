"use client"

import { useEffect, useState } from "react"
import { jsonRequest, messageOf } from "@/lib/client"

type PushState = "loading" | "unsupported" | "unconfigured" | "on" | "off" | "error"

export async function disconnectPush() {
  if (!("serviceWorker" in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration("/")
  const subscription = await registration?.pushManager?.getSubscription()
  if (!subscription) return
  await jsonRequest("/api/push", { action: "disable", endpoint: subscription.endpoint })
  await subscription.unsubscribe()
}

export function PushSettings() {
  const [state, setState] = useState<PushState>("loading")
  const [publicKey, setPublicKey] = useState("")
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    let alive = true
    async function init() {
      if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) {
        if (alive) setState("unsupported")
        return
      }
      try {
        const { key } = await jsonRequest<{ key: string | null }>("/api/push")
        if (!key) { if (alive) setState("unconfigured"); return }
        await navigator.serviceWorker.register("/push-worker.js")
        const active = await navigator.serviceWorker.ready
        const subscription = await active.pushManager.getSubscription()
        const status = subscription && await jsonRequest<{ enabled: boolean }>("/api/push", { action: "status", endpoint: subscription.endpoint })
        if (alive) {
          setPublicKey(key)
          setRegistration(active)
          setState(status?.enabled && Notification.permission === "granted" ? "on" : "off")
        }
      } catch (error) { if (alive) { setState("error"); setNotice(messageOf(error)) } }
    }
    void init()
    return () => { alive = false }
  }, [])

  async function toggle() {
    if (!registration || busy) return
    setBusy(true)
    setNotice("")
    try {
      if (state === "on") {
        await disconnectPush()
        setState("off")
        return
      }
      if (await Notification.requestPermission() !== "granted") throw new Error("Izin notifikasi belum diberikan. Periksa pengaturan browser atau HP.")
      let subscription = await registration.pushManager.getSubscription()
      if (subscription) await subscription.unsubscribe()
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })
      const { keys } = subscription.toJSON()
      await jsonRequest("/api/push", { action: "enable", endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth })
      setState("on")
    } catch (error) { setNotice(messageOf(error)) }
    finally { setBusy(false) }
  }

  return <div className="push-settings">
    <h3 className="font-semibold">Pengingat di perangkat ini</h3>
    <p className="muted">{state === "unsupported" ? "Browser ini belum mendukung push. Di iPhone, tambahkan LevelUp ke Layar Utama dari Safari lalu buka ikonnya."
      : state === "unconfigured" ? "Notifikasi push belum tersedia."
      : state === "on" ? "Aktif. Setel jam pengingat di menu Habit."
      : state === "loading" ? "Memeriksa dukungan notifikasi…"
      : state === "error" ? "Status notifikasi belum dapat diperiksa."
      : "Aktifkan untuk menerima pengingat meski LevelUp ditutup."}</p>
    {(state === "on" || state === "off") && <button className="secondary" onClick={() => void toggle()} disabled={busy}>{state === "on" ? "Matikan notifikasi" : "Aktifkan notifikasi HP"}</button>}
    {notice && <p className="notice" role="status">{notice}</p>}
  </div>
}
