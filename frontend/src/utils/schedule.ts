export interface TimedActivity {
  itemName: string
  startTime?: string | null
  endTime?: string | null
}

function minutes(value?: string | null): number | null {
  if (!value || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  const [hour, minute] = value.split(':').map(Number)
  return hour! * 60 + minute!
}

/** Stable chronological order; activities without a start time remain at the end. */
export function byStartTime<T extends TimedActivity>(items: readonly T[]): T[] {
  return items.map((item, index) => ({ item, index, start: minutes(item.startTime) }))
    .sort((a, b) => (a.start ?? 1440) - (b.start ?? 1440) || a.index - b.index)
    .map(entry => entry.item)
}

/** Insert after existing equal-time activities; never change the activity's chosen times. */
export function insertByTime<T extends TimedActivity>(items: readonly T[], item: T, previousIndex?: number): T[] {
  return byStartTime([...items.filter((_, index) => index !== previousIndex), item])
}

export function needsTimeOrder(items: readonly TimedActivity[]): boolean {
  return byStartTime(items).some((item, index) => item !== items[index])
}

/** Missing end times are points, not invented visit durations. Adjacent intervals may touch. */
export function timeConflicts(item: TimedActivity, others: readonly TimedActivity[]): string[] {
  const start = minutes(item.startTime)
  if (start === null) return []
  const end = minutes(item.endTime)
  return others.filter(other => {
    const otherStart = minutes(other.startTime), otherEnd = minutes(other.endTime)
    if (otherStart === null) return false
    const range = end !== null && end > start
    const otherRange = otherEnd !== null && otherEnd > otherStart
    if (range && otherRange) return Math.max(start, otherStart) < Math.min(end!, otherEnd!)
    if (range) return start <= otherStart && otherStart < end!
    if (otherRange) return otherStart <= start && start < otherEnd!
    return start === otherStart
  }).map(other => other.itemName)
}
