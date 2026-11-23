import { http } from '@/utils/request'
import type { DeleteResult, FavoriteItem, PageResult, PageQuery } from '@/types/api'

/** M3 收藏（只允许收藏本地自建景点） */
export const favoriteApi = {
  list(params: PageQuery & { keyword?: string; city?: string }) {
    return http.get<PageResult<FavoriteItem>>('/favorites', {
      page: params.page ?? 1,
      size: params.size ?? 10,
      keyword: params.keyword || undefined,
      city: params.city || undefined
    })
  },
  add(attractionId: string) {
    return http.post<{ favoriteId: string; attractionId: string }>('/favorites', { attractionId })
  },
  remove(attractionId: string) {
    return http.delete<DeleteResult>(`/favorites/${attractionId}`)
  }
}
