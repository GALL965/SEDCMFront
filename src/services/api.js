const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

export async function fetchJson(path, options = {}) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = `${API_BASE_URL}${normalizedPath}`

  let response

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.headers || {})
      }
    })
  } catch (error) {
    throw new Error(`No se pudo conectar con el backend: ${error.message}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text().catch(() => '')

  if (!response.ok) {
    const message = body && typeof body === 'object' && body.message
      ? body.message
      : `Respuesta no OK del backend: ${response.status}`

    throw new Error(message)
  }

  return body
}

export function getHealth() {
  return fetchJson('/health')
}

export function getInventory() {
  return fetchJson('/api/v1/inventory')
}
