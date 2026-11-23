import { http } from '@/utils/request'
import type {
  BudgetComparisonResult,
  CategoryStatistics,
  StatisticsOverview,
  TripCostsResult
} from '@/types/api'

/** M7 统计与可视化（只统计真实数据库数据，不含 AI 预估费用） */
export const statisticsApi = {
  overview() {
    return http.get<StatisticsOverview>('/statistics/overview')
  },
  expenseCategories(tripId?: string) {
    return http.get<CategoryStatistics>('/statistics/expense-categories', {
      tripId: tripId || undefined
    })
  },
  tripCosts(limit = 10) {
    return http.get<TripCostsResult>('/statistics/trip-costs', { limit })
  },
  budgetComparison(limit = 10) {
    return http.get<BudgetComparisonResult>('/statistics/budget-comparison', { limit })
  }
}
