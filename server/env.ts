type ServerEnv = Readonly<{
  databaseUrl: string
  appOrigin: string
  rateLimitSecret: string
  secureCookies: boolean
}>

export type GoogleOAuthEnv = Readonly<{
  appOrigin: string
  clientId: string
  clientSecret: string
  stateSecret: string
}>

let cached: ServerEnv | undefined
let cachedGoogleOAuth: GoogleOAuthEnv | undefined

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

export function getEnv(): ServerEnv {
  if (cached) return cached

  const appOrigin = (process.env.APP_ORIGIN?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '')).replace(/\/$/, '')
  if (!appOrigin) throw new Error('APP_ORIGIN or VERCEL_URL is required.')
  const parsedOrigin = new URL(appOrigin)
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin !== appOrigin) {
    throw new Error('APP_ORIGIN must be an exact http(s) origin without a path.')
  }

  const databaseUrl = requireEnv('DATABASE_URL')
  const parsedDatabaseUrl = new URL(databaseUrl)
  if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.')
  }

  const rateLimitSecret = requireEnv('RATE_LIMIT_SECRET')
  if (rateLimitSecret.length < 32) {
    throw new Error('RATE_LIMIT_SECRET must contain at least 32 characters.')
  }

  cached = {
    databaseUrl,
    appOrigin,
    rateLimitSecret,
    secureCookies: parsedOrigin.protocol === 'https:',
  }
  return cached
}

export function isGoogleOAuthConfigured(): boolean {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const stateSecret = process.env.OAUTH_STATE_SECRET?.trim()
  return Boolean(clientId && clientSecret && stateSecret && stateSecret.length >= 32)
}

export function getGoogleOAuthEnv(): GoogleOAuthEnv {
  if (cachedGoogleOAuth) return cachedGoogleOAuth

  const clientId = requireEnv('GOOGLE_CLIENT_ID')
  const clientSecret = requireEnv('GOOGLE_CLIENT_SECRET')
  const stateSecret = requireEnv('OAUTH_STATE_SECRET')
  if (stateSecret.length < 32) {
    throw new Error('OAUTH_STATE_SECRET must contain at least 32 characters.')
  }

  cachedGoogleOAuth = {
    appOrigin: getEnv().appOrigin,
    clientId,
    clientSecret,
    stateSecret,
  }
  return cachedGoogleOAuth
}
