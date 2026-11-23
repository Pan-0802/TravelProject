import { http } from '@/utils/request'
import { allPages } from '@/utils/pagination'
import type { DeleteResult, PageResult, Trip, TripPayload, TripQuery } from '@/types/api'

/** M2 旅行计划 */
export const tripApi = {
  options(): Promise<Trip[]> {
    return allPages((page, size) => tripApi.list({ page, size }))
  },
  list(params: TripQuery) {
    return http.get<PageResult<Trip>>('/trips', {
      page: params.page ?? 1,
      size: params.size ?? 10,
      keyword: params.keyword || undefined,
      status: params.status || undefined
    })
  },
  create(payload: TripPayload) {
    return http.post<Trip>('/trips', payload)
  },
  detail(tripId: string) {
    return http.get<Trip>(`/trips/${tripId}`)
  },
  update(tripId: string, payload: Partial<TripPayload>) {
    return http.patch<Trip>(`/trips/${tripId}`, payload)
  },
  remove(tripId: string) {
    return http.delete<DeleteResult>(`/trips/${tripId}`)
  }
}
