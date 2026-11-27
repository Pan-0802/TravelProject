import axios, { type AxiosRequestConfig } from 'axios'
import { ElMessage } from 'element-plus'
import { clearAuth, getToken, redirectToLogin } from './auth'
import type { ApiResponse } from '@/types/api'

/** 统一的错误对象：保留业务 code 与 HTTP status，便于页面按错误码分支处理 */
export interface ApiError extends Error {
  code: number
  status?: number
  fieldErrors?: Record<string, string>
}

export interface RequestOptions extends AxiosRequestConfig {
  /** 为 true 时不在拦截器里弹提示，由调用方自行处理（如 AI 覆盖确认的 409） */
  silent?: boolean
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || '/api',
  timeout: 3000,
  headers: { 'Content-Type': 'application/json; charset=UTF-8' }
})

instance.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse<unknown>
    // 后端统一包装：code === 0 才是成功
    if (!body || typeof body.code !== 'number' || body.code !== 0) {
      const message = (body && body.message) || '请求失败'
      const error = new Error(message) as ApiError
      error.code = (body && body.code) || -1
      error.status = response.status
      error.fieldErrors = (body.data as { fieldErrors?: Record<string, string> } | null)?.fieldErrors
      if (!(response.config as RequestOptions).silent) {
        ElMessage.error(message)
      }
      return Promise.reject(error)
    }
    // 直接返回 data，业务层拿到的就是解包后的数据
    return body.data as never
  },
  (error) => {
    const config = (error.config || {}) as RequestOptions
    const status: number | undefined = error.response?.status
    const body = error.response?.data as { code?: number; message?: string; data?: { fieldErrors?: Record<string, string> } } | undefined

    const statusMessages: Record<number,string> = {
      400:'填写内容或请求格式不正确，请检查后重试',
      403:'当前操作未获授权，请检查登录状态和前后端地址配置',
      404:'记录不存在或已被删除，请刷新列表',
      409:'数据已经变化，请刷新后确认再操作',
      429:'请求较频繁，请稍后重试',
      500:'服务暂时异常，请稍后重试',
      502:'外部服务响应异常，请稍后重试',
      503:'服务暂时不可用，请稍后重试',
      504:'外部服务响应超时，请稍后重试'
    }
    let message = body?.message || statusMessages[status || 0] || '网络异常，请检查连接后重试'

    if (status === 401) {
      const isLogin = /\/auth\/login$/.test(config.url || '')
      message = isLogin ? (body?.message || '账号或密码错误') : '登录状态已失效，请重新登录'
      if (!isLogin) clearAuth()
      if (!config.silent) ElMessage.error(message)
      if (!isLogin) redirectToLogin()
    } else if (error.code === 'ECONNABORTED' || /timeout/i.test(String(error.message))) {
      message = '超过 3 秒未收到响应，请检查网络后重试；写入操作请先刷新确认结果。'
      if (!config.silent) ElMessage.error(message)
    } else if (!error.response) {
      message = '无法连接后端服务，请确认后端已启动（默认 http://localhost:8080）'
      if (!config.silent) ElMessage.error(message)
    } else if (!config.silent) {
      ElMessage.error(message)
    }

    const apiError = new Error(message) as ApiError
    apiError.code = body?.code ?? -1
    apiError.status = status
    apiError.fieldErrors = body?.data?.fieldErrors
    return Promise.reject(apiError)
  }
)

/** 把 axios 的 AxiosResponse 收窄为解包后的业务数据 */
export const http = {
  get<T>(url: string, params?: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
    return instance.get(url, { params, ...options }) as unknown as Promise<T>
  },
  post<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return instance.post(url, data, options) as unknown as Promise<T>
  },
  patch<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return instance.patch(url, data, options) as unknown as Promise<T>
  },
  put<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    return instance.put(url, data, options) as unknown as Promise<T>
  },
  delete<T>(url: string, options: RequestOptions = {}): Promise<T> {
    return instance.delete(url, options) as unknown as Promise<T>
  }
}

/** 供 Mock 层复用同一个 axios 实例（Mock 通过 adapter 接管请求） */
export const axiosInstance = instance

/** 取错误码，便于 409/422 分支判断 */
export function errorCode(error: unknown): number {
  return (error as ApiError)?.code ?? -1
}

export function errorMessage(error: unknown, fallback = '操作失败'): string {
  return (error as Error)?.message || fallback
}
