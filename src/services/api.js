const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3000'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, '')

function buildQuery(params = {}) {
  const query = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value)
    }
  })

  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

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
    const message = body && typeof body === 'object'
      ? body.message || body.detail || body.error || `Respuesta no OK del backend: ${response.status}`
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

export function getNodeTelemetry(params = {}) {
  return fetchJson(`/api/v1/telemetry/node${buildQuery({ limit: 50, ...params })}`)
}

export function getEnvironmentTelemetry(params = {}) {
  return fetchJson(`/api/v1/telemetry/environment${buildQuery({ limit: 50, ...params })}`)
}

export function getAuditCommands(params = {}) {
  return fetchJson(`/api/v1/audit/commands${buildQuery({ limit: 50, ...params })}`)
}

export function sendManualCommand(payload) {
  return fetchJson('/api/v1/commands', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })
}
