import { http } from '@/utils/request'
import { allPages } from '@/utils/pagination'
import type {
  Attraction,
  AttractionPayload,
  AttractionQuery,
  DeleteResult,
  PageResult
} from '@/types/api'

/** M3 本地自建景点（可收藏、可被行程引用） */
export const attractionApi = {
  options(): Promise<Attraction[]> {
    return allPages((page, size) => attractionApi.list({ page, size }))
  },
  list(params: AttractionQuery) {
    return http.get<PageResult<Attraction>>('/attractions', {
      page: params.page ?? 1,
      size: params.size ?? 10,
      keyword: params.keyword || undefined,
      city: params.city || undefined,
      mineOnly: params.mineOnly ?? false
    })
  },
  detail(attractionId: string) {
    return http.get<Attraction>(`/attractions/${attractionId}`)
  },
  create(payload: AttractionPayload) {
    return http.post<Attraction>('/attractions', payload)
  },
  update(attractionId: string, payload: Partial<AttractionPayload>) {
    return http.patch<Attraction>(`/attractions/${attractionId}`, payload)
  },
  remove(attractionId: string) {
    return http.delete<DeleteResult>(`/attractions/${attractionId}`)
  }
}
