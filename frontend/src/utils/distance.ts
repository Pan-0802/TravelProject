import { poiApi } from '@/api/poi'

/** 坐标点 */
export interface GeoPoint {
  lat: number
  lng: number
}

const STORAGE_KEY = 'tp_geo_cache_v1'

let cache: Record<string, GeoPoint | null> = loadCache()

function loadCache(): Record<string, GeoPoint | null> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, GeoPoint | null>
  } catch {
    return {}
  }
}

function persistCache() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 忽略隐私模式下的写入失败
  }
}

const EARTH_RADIUS_KM = 6371

/** 两点球面距离（公里，直线距离） */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** 不同交通方式的平均速度（km/h），用于估算在路上的时间 */
const SPEEDS: Record<string, number> = {
  步行: 4.5,
  骑行: 14,
  公交: 18,
  地铁: 24,
  公共交通: 22,
  打车: 32,
  自驾: 38,
  高铁: 200,
  飞机: 600
}

/** 估算路上需要多少分钟：距离 / 速度 + 绕行与等待时间 */
export function estimateMinutes(km: number, transportation?: string | null): number {
  const speed = SPEEDS[transportation || '步行'] ?? 4.5
  const minutes = (km / speed) * 60 * 1.25 + 5
  return Math.max(2, Math.round(minutes))
}

/** 行程里常见的时间段展示 */
export function formatKm(km: number): string {
  if (!Number.isFinite(km)) return '—'
  return km < 1 ? `${Math.round(km * 1000)} 米` : `${km.toFixed(1)} 公里`
}

export function formatMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '—'
  if (minutes < 60) return `约 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `约 ${hours} 小时 ${rest} 分钟` : `约 ${hours} 小时`
}

/**
 * 通过后端高德代理查一个地点名的经纬度。
 * 结果按「城市|名称」缓存到 localStorage，避免重复消耗高德配额。
 */
export async function geocodePlace(name: string, city: string): Promise<GeoPoint | null> {
  const trimmedName = (name || '').trim()
  const trimmedCity = (city || '').trim()
  if (!trimmedName) return null

  const key = `${trimmedCity}|${trimmedName}`
  if (key in cache) return cache[key]

  try {
    const result = await poiApi.search({
      keywords: trimmedName,
      region: trimmedCity || '全国',
      cityLimit: Boolean(trimmedCity),
      page: 1,
      size: 1
    })
    const first = result.list && result.list[0]
    const point =
      first && first.latitude !== null && first.longitude !== null
        ? { lat: Number(first.latitude), lng: Number(first.longitude) }
        : null
    cache[key] = point
    persistCache()
    return point
  } catch {
    // 高德未配置 / 超配额 / 超时：缓存失败结果，避免每次都卡住
    cache[key] = null
    persistCache()
    return null
  }
}

/** 清空坐标缓存（换城市或景点名重复时可用） */
export function clearGeoCache() {
  cache = {}
  persistCache()
}
