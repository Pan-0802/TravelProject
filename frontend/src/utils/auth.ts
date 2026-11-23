import type { User } from '@/types/api'

const TOKEN_KEY = 'accessToken'
const USER_KEY = 'currentUser'

/** Token 放 sessionStorage：关闭标签页即失效（契约 1.4） */
export function getToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

export function setToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export function getStoredUser(): User | null {
  const raw = sessionStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

export function setStoredUser(user: User): void {
  sessionStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(USER_KEY)
}

/** 清理登录态并回到登录页，带上 redirect 便于登录后跳回原页面 */
export function redirectToLogin(): void {
  clearAuth()
  const { pathname, search, hash } = window.location
  if (pathname.startsWith('/auth')) return
  const redirect = encodeURIComponent(pathname + search + hash)
  window.location.replace(`/auth/login?redirect=${redirect}`)
}
