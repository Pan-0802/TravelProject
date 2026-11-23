import dayjs from 'dayjs'

/** 金额：¥1,234.50（两位小数，规避 0.1+0.2 之类的展示误差） */
export function money(value: number | null | undefined): string {
  const num = Number(value ?? 0)
  if (Number.isNaN(num)) return '¥0.00'
  return `¥${num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** 金额（不带符号），用于图表、输入框回填 */
export function amount(value: number | null | undefined): string {
  const num = Number(value ?? 0)
  return num.toFixed(2)
}

/** 2026-12-01 -> 12-01 */
export function shortDate(date: string | null | undefined): string {
  if (!date) return '—'
  return dayjs(date).format('MM-DD')
}

/** 2026-12-01 -> 2026年12月1日 */
export function longDate(date: string | null | undefined): string {
  if (!date) return '—'
  return dayjs(date).format('YYYY年M月D日')
}

/** 星期几：周一 */
export function weekday(date: string | null | undefined): string {
  if (!date) return ''
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return names[dayjs(date).day()]
}

/** 日期区间文本 */
export function dateRange(start?: string | null, end?: string | null): string {
  if (!start || !end) return '—'
  return `${start} ~ ${end}`
}

/** 时间区间：09:00-11:00 */
export function timeRange(start?: string | null, end?: string | null): string {
  if (!start && !end) return '时间待定'
  if (start && end) return `${start} - ${end}`
  return start ? `${start} 起` : `至 ${end}`
}

/** 含首尾的天数：endDate - startDate + 1 */
export function daysBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0
  const diff = dayjs(end).startOf('day').diff(dayjs(start).startOf('day'), 'day')
  return diff < 0 ? 0 : diff + 1
}

/** yyyy-MM-dd'T'HH:mm:ss -> yyyy-MM-dd HH:mm */
export function dateTime(value?: string | null): string {
  if (!value) return '—'
  const d = dayjs(value)
  return d.isValid() ? d.format('YYYY-MM-DD HH:mm') : String(value)
}

/** 分钟 -> 1小时30分钟 */
export function durationText(minutes?: number | null): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h && m) return `${h}小时${m}分钟`
  if (h) return `${h}小时`
  return `${m}分钟`
}

/** 今日 yyyy-MM-dd */
export function today(): string {
  return dayjs().format('YYYY-MM-DD')
}
