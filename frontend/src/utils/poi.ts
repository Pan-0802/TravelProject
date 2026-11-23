import type { AttractionPayload, PoiItem } from '@/types/api'

/** Collapse repeated AMap hierarchy segments into a short, editable local category. */
export function poiCategory(type: string | null): string {
  const parts = [...new Set((type || '').split(/[;；|]/).map(value => value.trim()).filter(Boolean))]
  const useful = parts.filter(part => !parts.some(other => other !== part && other.startsWith(part)))
  return Array.from(useful.join(' / ')).slice(0, 40).join('')
}

export function poiPrefill(poi: PoiItem): Partial<AttractionPayload> {
  return {
    name: Array.from(poi.name.trim()).slice(0, 120).join(''),
    city: Array.from((poi.city || '').trim()).slice(0, 80).join(''),
    category: poiCategory(poi.type) || null
  }
}
