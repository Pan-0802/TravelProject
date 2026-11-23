import { http } from '@/utils/request'
import type { LoginResult, RegisterPayload, RegisterResult, User } from '@/types/api'

/** M1 用户管理 */
export const authApi = {
  register(payload: RegisterPayload) {
    return http.post<RegisterResult>('/auth/register', payload)
  },
  login(payload: { username: string; password: string }) {
    return http.post<LoginResult>('/auth/login', payload)
  },
  logout() {
    return http.post<{ loggedOut: boolean }>('/auth/logout')
  },
  getMe() {
    return http.get<User>('/users/me')
  },
  updateNickname(payload: { nickname: string }) {
    return http.patch<User>('/users/me', payload)
  },
  changePassword(payload: { oldPassword: string; newPassword: string; confirmPassword: string }) {
    return http.patch<{ updated: boolean }>('/users/me/password', payload)
  }
}
