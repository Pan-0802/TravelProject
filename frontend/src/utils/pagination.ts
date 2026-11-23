import type { PageResult } from '@/types/api'

/** Selector options must not silently omit items beyond the first backend page. */
export async function allPages<T>(fetchPage: (page: number, size: number) => Promise<PageResult<T>>): Promise<T[]> {
  const result: T[] = []
  for (let page = 1; ; page++) {
    const response = await fetchPage(page, 50)
    result.push(...response.list)
    if (!response.list.length || page * response.size >= response.total) return result
  }
}
