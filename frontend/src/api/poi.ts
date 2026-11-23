import { http } from '@/utils/request'
import type { PoiSearchResult } from '@/types/api'

/** M3 高德 POI 实时查询（后端代理，前端不接触 Key） */
export const poiApi = {
  search(params: {
    keywords: string
    region: string
    cityLimit?: boolean
    page?: number
    size?: number
  }) {
    return http.get<PoiSearchResult>('/pois/search', {
      keywords: params.keywords,
      region: params.region,
      cityLimit: params.cityLimit ?? true,
      page: params.page ?? 1,
      size: params.size ?? 10
    })
  }
}
