import { createHash } from 'node:crypto'
import { getEnv } from './env.js'

type HeaderValue = string | string[] | undefined

export type ApiRequest = {
  method?: string
  headers: Record<string, HeaderValue>
  body?: unknown
  cookies: Record<string, string>
  query?: Record<string, string | string[] | undefined>
}

export type ApiResponse = {
  setHeader(name: string, value: string | string[]): unknown
  status(code: number): ApiResponse
  json(body: unknown): void
  end(): void
}

export type ApiHandler = (request: ApiRequest, response: ApiResponse) => Promise<void>

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function withApi(handler: ApiHandler): ApiHandler {
  return async (request, response) => {
    setSecurityHeaders(response)
    response.setHeader('Cache-Control', 'no-store')

    try {
      await handler(request, response)
    } catch (error) {
      if (error instanceof ApiError) {
        response.status(error.status).json({ error: { code: error.code, message: error.message } })
        return
      }
      // Do not log exception messages: database drivers and runtimes can include
      // connection details, query text, usernames, or other request data.
      response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Try again.' } })
    }
  }
}

export function allowMethod(request: ApiRequest, response: ApiResponse, method: string): void {
  response.setHeader('Allow', method)
  if (request.method !== method) throw new ApiError(405, 'METHOD_NOT_ALLOWED', `Use ${method} for this endpoint.`)
}

export function requireSameOrigin(request: ApiRequest): void {
  const originHeader = request.headers.origin
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader
  const expectedOrigins = new Set([getEnv().appOrigin])
  if (process.env.VERCEL_URL) expectedOrigins.add(`https://${process.env.VERCEL_URL}`)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    expectedOrigins.add(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  if (!origin || !expectedOrigins.has(origin)) {
    throw new ApiError(403, 'ORIGIN_REJECTED', 'This request did not come from the game site.')
  }
}

export function getJsonBody(request: ApiRequest): Record<string, unknown> {
  const contentTypeHeader = request.headers['content-type']
  const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
  if (!contentType?.toLowerCase().startsWith('application/json')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send this request as JSON.')
  }
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)) {
    throw new ApiError(400, 'INVALID_BODY', 'Send a valid JSON object.')
  }
  return request.body as Record<string, unknown>
}

export function getQueryValue(request: ApiRequest, name: string, maxLength = 2048): string {
  const value = request.query?.[name]
  const scalar = Array.isArray(value) ? value[0] : value
  if (typeof scalar !== 'string' || scalar.length === 0 || scalar.length > maxLength) return ''
  return scalar
}

export function getClientKey(request: ApiRequest, purpose: string): string {
  const forwarded = request.headers['x-forwarded-for']
  const rawIp = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || 'unknown'
  return createHash('sha256')
    .update(`${getEnv().rateLimitSecret}:${purpose}:${rawIp}`)
    .digest('hex')
}

export function getIdentifierKey(purpose: string, identifier: string): string {
  return createHash('sha256')
    .update(`${getEnv().rateLimitSecret}:${purpose}:${identifier}`)
    .digest('hex')
}

function setSecurityHeaders(response: ApiResponse): void {
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
}

