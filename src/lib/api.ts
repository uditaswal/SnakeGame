export class ClientApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
  } catch {
    throw new ClientApiError(
      'API_UNAVAILABLE',
      'Account services are unavailable here. For local sign-in, run pnpm dev after signing in to Vercel.',
      0,
    )
  }

  if (response.status === 204) return undefined as T
  let payload: T & { error?: { code?: string; message?: string } }
  try {
    payload = await response.json() as T & { error?: { code?: string; message?: string } }
  } catch {
    throw new ClientApiError(
      'API_UNAVAILABLE',
      'Account services are unavailable here. For local sign-in, run pnpm dev after signing in to Vercel.',
      response.status,
    )
  }
  if (!response.ok) {
    throw new ClientApiError(
      payload.error?.code || 'REQUEST_FAILED',
      payload.error?.message || 'The request failed. Try again.',
      response.status,
    )
  }
  return payload
}

