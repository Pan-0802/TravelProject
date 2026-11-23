import { http } from '@/utils/request'
import type {
  DeleteResult,
  ItineraryItem,
  ItineraryItemPayload,
  TripDaysResult
} from '@/types/api'

/** M4 行程安排 */
export const itineraryApi = {
  /** 返回旅行日期范围内每一天（无真实 trip_day 时 dayId 为 null 的占位日） */
  days(tripId: string) {
    return http.get<TripDaysResult>(`/trips/${tripId}/days`)
  },
  createItem(tripId: string, date: string, payload: ItineraryItemPayload) {
    return http.post<ItineraryItem>(`/trips/${tripId}/days/${date}/items`, payload)
  },
  updateItem(itemId: string, payload: Partial<ItineraryItemPayload>) {
    return http.patch<ItineraryItem>(`/itinerary-items/${itemId}`, payload)
  },
  deleteItem(itemId: string) {
    return http.delete<DeleteResult>(`/itinerary-items/${itemId}`)
  },
  /** 必须传该天全部行程项 ID，顺序即最终顺序 */
  reorder(tripId: string, date: string, itemIds: string[]) {
    return http.put<ItineraryItem[]>(`/trips/${tripId}/days/${date}/items/order`, { itemIds })
  }
}
