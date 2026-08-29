const API_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (!response.ok) {
    let message = 'No se pudo completar la solicitud.'
    try {
      const body = await response.json()
      message = Array.isArray(body.detail)
        ? body.detail.map((item) => item.msg).join(' ')
        : body.detail || message
    } catch {
      // Keep the recoverable default message.
    }
    throw new ApiError(message, response.status)
  }
  if (response.status === 204) return null
  return response.json()
}

export function queryString(params) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '' && value !== null && value !== undefined) query.set(key, value)
  })
  return query.toString()
}

export { API_URL }
