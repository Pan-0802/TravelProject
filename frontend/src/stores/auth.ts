import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { authApi } from '@/api/auth'
import type { LoginResult, User } from '@/types/api'
import { clearAuth, getStoredUser, getToken, setStoredUser, setToken } from '@/utils/auth'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string>(getToken())
  const user = ref<User | null>(getStoredUser())

  const isLoggedIn = computed(() => Boolean(token.value))
  const displayName = computed(() => user.value?.nickname || user.value?.username || '未登录')
  const avatarText = computed(() => {
    const name = user.value?.nickname || user.value?.username || '?'
    return name.slice(0, 1).toUpperCase()
  })

  function setSession(result: LoginResult) {
    token.value = result.accessToken
    user.value = result.user
    setToken(result.accessToken)
    setStoredUser(result.user)
  }

  function applyUser(next: User) {
    user.value = next
    setStoredUser(next)
  }

  async function login(username: string, password: string) {
    const result = await authApi.login({ username, password })
    setSession(result)
    return result
  }

  /** 刷新页面后拉取最新资料，失败不阻断页面（401 由拦截器统一处理） */
  async function refreshMe() {
    if (!token.value) return null
    const me = await authApi.getMe()
    applyUser(me)
    return me
  }

  async function logout() {
    try {
      if (token.value) await authApi.logout()
    } catch {
      // 后端不可用时也要允许前端退出
    } finally {
      token.value = ''
      user.value = null
      clearAuth()
    }
  }

  function resetLocal() {
    token.value = ''
    user.value = null
    clearAuth()
  }

  return {
    token,
    user,
    isLoggedIn,
    displayName,
    avatarText,
    setSession,
    applyUser,
    login,
    refreshMe,
    logout,
    resetLocal
  }
})
