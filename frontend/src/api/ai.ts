import { http } from '@/utils/request'
import type {
  AiGeneratePayload,
  AiPlan,
  AiPlanListItem,
  AiPlanQuery,
  AiSavePayload,
  AiSaveResult,
  PageResult
} from '@/types/api'

/** M6 AI 智能旅行规划 */
export const aiApi = {
  /** Include connect/read timeout plus network overhead; never automatically retry billable generation. */
  generate(payload: AiGeneratePayload) {
    return http.post<AiPlan>('/ai/plans', payload, { timeout: 90000, silent: true })
  },
  list(params: AiPlanQuery) {
    return http.get<PageResult<AiPlanListItem>>('/ai/plans', {
      page: params.page ?? 1,
      size: params.size ?? 10,
      status: params.status || undefined
    })
  },
  detail(aiPlanId: string) {
    return http.get<AiPlan>(`/ai/plans/${aiPlanId}`)
  },
  /** 409 = 目标旅行已有行程，需前端确认覆盖后带 confirmOverwrite=true 重试 */
  save(aiPlanId: string, payload: AiSavePayload) {
    return http.post<AiSaveResult>(`/ai/plans/${aiPlanId}/save`, payload, { silent: true, timeout: 30000 })
  }
}
