import { http } from '@/utils/request'
import type {
  BudgetSummary,
  DeleteResult,
  Expense,
  ExpensePayload,
  ExpenseQuery,
  PageResult
} from '@/types/api'

/** M5 消费与预算 */
export const expenseApi = {
  list(tripId: string, params: ExpenseQuery) {
    return http.get<PageResult<Expense>>(`/trips/${tripId}/expenses`, {
      page: params.page ?? 1,
      size: params.size ?? 20,
      category: params.category || undefined,
      startDate: params.startDate || undefined,
      endDate: params.endDate || undefined
    })
  },
  create(tripId: string, payload: ExpensePayload) {
    return http.post<Expense>(`/trips/${tripId}/expenses`, payload)
  },
  update(expenseId: string, payload: Partial<ExpensePayload>) {
    return http.patch<Expense>(`/expenses/${expenseId}`, payload)
  },
  remove(expenseId: string) {
    return http.delete<DeleteResult>(`/expenses/${expenseId}`)
  },
  budgetSummary(tripId: string) {
    return http.get<BudgetSummary>(`/trips/${tripId}/budget-summary`)
  }
}
