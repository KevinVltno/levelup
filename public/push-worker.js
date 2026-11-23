self.addEventListener("push", (event) => {
  if (!event.data) return
  const { name, tag } = event.data.json()
  event.waitUntil(self.registration.showNotification("Pengingat LevelUp", {
    body: "Waktunya " + name,
    icon: "/levelup-192.png",
    tag,
    data: { path: "/#habit" },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL(event.notification.data.path, self.location.origin)
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const current = windows.find((client) => new URL(client.url).origin === url.origin)
    if (current) {
      const navigated = await current.navigate(url.href)
      if (navigated) return navigated.focus()
    }
    return self.clients.openWindow(url.href)
  })())
})
