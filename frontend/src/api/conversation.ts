import { http } from '@/utils/request'
import type { AiGeneratePayload, AiPlan, AiPlanDay, PageResult } from '@/types/api'

export interface ChatMessage {
  messageId: string
  requestId: string
  role: 'user' | 'assistant'
  content: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED'
  errorMessage: string | null
  planId: string | null
  createdAt: string
}
export interface ConversationSummary {
  conversationId: string
  title: string
  version: number
  processing: boolean
  createdAt: string
  updatedAt: string
}
export interface Conversation extends ConversationSummary {
  conditions: AiGeneratePayload
  memory: string
  currentPlan: AiPlan | null
  currentDays: AiPlanDay[] | null
  messages: ChatMessage[]
}
export interface SendMessage {
  requestId: string
  expectedVersion: number
  content: string
  intent: 'AUTO' | 'ASK' | 'REVISE'
  currentDays?: AiPlanDay[] | null
}
export const conversationApi = {
  create(payload: { conditions?: AiGeneratePayload; aiPlanId?: string; currentDays?: AiPlanDay[] }) {
    return http.post<Conversation>('/ai/conversations', payload, { silent: true })
  },
  list(page = 1) {
    return http.get<PageResult<ConversationSummary>>('/ai/conversations', { page, size: 20 }, { silent: true })
  },
  detail(id: string) {
    return http.get<Conversation>(`/ai/conversations/${id}`, undefined, { silent: true })
  },
  send(id: string, payload: SendMessage, signal?: AbortSignal) {
    return http.post<Conversation>(`/ai/conversations/${id}/messages/submit`, payload, { silent: true, signal })
  },
  edit(id: string, expectedVersion: number, days: AiPlanDay[]) {
    return http.put<Conversation>(`/ai/conversations/${id}/draft`, { expectedVersion, days }, { silent: true })
  },
  remove(id: string) {
    return http.delete(`/ai/conversations/${id}`, { silent: true })
  }
}
