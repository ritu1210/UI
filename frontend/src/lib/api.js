// Thin fetch wrapper for the Python backend JSON API (separate service, proxied at /api).
export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  if (res.status === 204) return null
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText || 'Request failed'
    throw new Error(typeof detail === 'string' ? detail : 'Request failed')
  }
  return data
}
