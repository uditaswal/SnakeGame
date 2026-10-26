import { apiRequest } from './api'

export type PublicUser = {
  id: string
  username: string
  authProvider: 'password' | 'google'
  createdAt: string
}

export function getSession(): Promise<{ user: PublicUser | null; providers: { google: boolean } }> {
  return apiRequest('/api/auth/session')
}

export function register(username: string, password: string): Promise<{ user: PublicUser }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function login(username: string, password: string): Promise<{ user: PublicUser }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function logout(): Promise<void> {
  return apiRequest('/api/auth/logout', { method: 'POST' })
}

export function changePassword(currentPassword: string, newPassword: string): Promise<{ ok: true }> {
  return apiRequest('/api/auth/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export function deleteAccount(password: string): Promise<void> {
  return apiRequest('/api/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  })
}

export function beginGoogleAccountDeletion(confirmation: string): Promise<{ authorizationUrl: string }> {
  return apiRequest('/api/auth/google/delete', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  })
}

