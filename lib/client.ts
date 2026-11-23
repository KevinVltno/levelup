export async function jsonRequest<T>(url: string, body?: object): Promise<T> {
  const response = await fetch(url, body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  } : { cache: "no-store" })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error ?? "Terjadi kendala. Coba kembali.")
  return data
}

export function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Terjadi kendala. Coba kembali."
}
