<template>
  <div
    v-loading="loading"
    element-loading-text="加载行程中…"
    class="itinerary-panel"
  >
    <div class="itinerary-panel__toolbar">
      <span class="tp-muted">
        共 {{ days.length }} 天行程，{{ totalItems }} 个活动。可使用上下箭头调整当天顺序。
      </span>
      <div class="itinerary-panel__actions">
        <el-button :icon="Guide" text :loading="distanceLoading" @click="computeDistances">
          {{ distanceComputed ? '重新计算距离' : '计算距离与用时' }}
        </el-button>
        <el-button :icon="Refresh" text @click="loadDays">刷新</el-button>
      </div>
    </div>

    <div v-if="!loading && days.length === 0" class="tp-empty">
      暂无行程数据。确认旅行日期范围后再试。
    </div>

    <el-card
      v-for="day in days"
      :key="day.date"
      shadow="never"
      class="day-card"
      :body-style="{ padding: '14px 16px' }"
    >
      <template #header>
        <div class="day-card__header">
          <div class="day-card__title">
            <span class="day-card__badge">第 {{ day.dayNumber }} 天</span>
            <span class="day-card__date">{{ longDate(day.date) }}</span>
            <span class="tp-muted">{{ weekday(day.date) }}</span>
            <el-tag v-if="day.description" size="small" type="info" effect="plain">
              {{ day.description }}
            </el-tag>
          </div>
          <el-button size="small" type="primary" plain :icon="Plus" @click="openAdd(day)">
            添加行程
          </el-button>
        </div>
      </template>

      <div v-if="sortedItems(day).length === 0" class="day-card__empty">
        这一天还没有安排，点击右上角“添加行程”开始规划。
      </div>

      <div v-else class="item-list">
        <template v-for="(item, index) in sortedItems(day)" :key="item.itemId">
          <div v-if="index > 0" class="item-segment">
            <template v-if="segmentOf(day, index)">
              <el-icon><Bottom /></el-icon>
              <span>{{ segmentText(day, index) }}</span>
              <span class="item-segment__tip">（直线距离估算，仅供参考）</span>
            </template>
            <template v-else-if="distanceComputed">
              <el-icon><WarningFilled /></el-icon>
              <span>上一站或本站未取到位置，无法估算距离</span>
            </template>
            <template v-else>
              <span class="item-segment__idle">点击右上角“计算距离与用时”可估算两站之间的距离</span>
            </template>
          </div>

          <div class="item">
            <div class="item__time">{{ timeRange(item.startTime, item.endTime) }}</div>

            <div class="item__main">
              <div class="item__name">
                {{ item.itemName }}
                <el-tag size="small" :type="item.sourceType === 'AI' ? 'success' : 'info'" effect="plain">
                  {{ SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType }}
                </el-tag>
              </div>
              <div class="item__meta">
                <span v-if="item.transportation">
                  <el-icon><Van /></el-icon>{{ item.transportation }}
                </span>
                <span><el-icon><Wallet /></el-icon>预计 {{ money(item.estimatedCost) }}</span>
                <span v-if="item.note" class="item__note">{{ item.note }}</span>
              </div>
            </div>

            <div class="item__actions">
              <el-button
                text
                size="small"
                :disabled="index === 0 || reordering"
                title="上移"
                @click="move(day, index, -1)"
              >
                <el-icon><Top /></el-icon>
              </el-button>
              <el-button
                text
                size="small"
                :disabled="index === sortedItems(day).length - 1 || reordering"
                title="下移"
                @click="move(day, index, 1)"
              >
                <el-icon><Bottom /></el-icon>
              </el-button>
              <el-button text size="small" type="primary" @click="openEdit(day, item)">编辑</el-button>
              <el-button text size="small" type="danger" @click="handleDelete(item)">删除</el-button>
            </div>
          </div>
        </template>
      </div>
    </el-card>

    <ItineraryItemDialog
      v-model="dialogVisible"
      :trip-id="trip.tripId"
      :date="editingDate"
      :item="editingItem"
      :next-sort-order="nextSortOrder"
      @saved="loadDays"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bottom, Guide, Plus, Refresh, Top, Van, Wallet, WarningFilled } from '@element-plus/icons-vue'
import { itineraryApi } from '@/api/itinerary'
import ItineraryItemDialog from '@/components/itinerary/ItineraryItemDialog.vue'
import { SOURCE_TYPE_LABELS } from '@/constants'
import type { ItineraryItem, Trip, TripDay } from '@/types/api'
import {
  estimateMinutes,
  formatKm,
  formatMinutes,
  geocodePlace,
  haversineKm,
  type GeoPoint
} from '@/utils/distance'
import { longDate, money, timeRange, weekday } from '@/utils/format'

const props = defineProps<{ trip: Trip }>()

const days = ref<TripDay[]>([])
const loading = ref(false)
const reordering = ref(false)
const dialogVisible = ref(false)
const editingDate = ref('')
const editingItem = ref<ItineraryItem | null>(null)
const nextSortOrder = ref(1)

/** 两站之间的估算结果，key = 日期#到达序号 */
interface SegmentInfo {
  km: number
  minutes: number
  transportation: string
}

const segments = ref<Record<string, SegmentInfo>>({})
const distanceComputed = ref(false)
const distanceLoading = ref(false)

function segmentOf(day: TripDay, index: number): SegmentInfo | null {
  return segments.value[`${day.date}#${index}`] || null
}

function segmentText(day: TripDay, index: number): string {
  const segment = segmentOf(day, index)
  if (!segment) return ''
  if (segment.km < 0.03) return '与上一站基本在同一位置'
  return `距上一站 ${formatKm(segment.km)} · ${segment.transportation}${formatMinutes(segment.minutes)}`
}

/** 并发预热坐标缓存，避免一次性打满高德配额 */
async function warmUpPlaces(names: string[]) {
  const queue = [...names]
  const workers = Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const name = queue.shift()
      if (name) await geocodePlace(name, props.trip.destination)
    }
  })
  await Promise.all(workers)
}

async function computeDistances() {
  if (distanceLoading.value) return
  distanceLoading.value = true
  try {
    const names = new Set<string>()
    for (const day of days.value) {
      for (const item of sortedItems(day)) names.add(item.itemName)
    }
    if (names.size === 0) {
      ElMessage.info('还没有行程项，先添加景点再计算距离')
      return
    }
    await warmUpPlaces([...names])

    const result: Record<string, SegmentInfo> = {}
    let computed = 0
    for (const day of days.value) {
      const items = sortedItems(day)
      let prevPoint: GeoPoint | null = null
      let prevItem: ItineraryItem | null = null
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const point = await geocodePlace(item.itemName, props.trip.destination)
        if (prevPoint && point) {
          const km = haversineKm(prevPoint, point)
          const transportation = item.transportation || prevItem?.transportation || '步行'
          result[`${day.date}#${index}`] = {
            km,
            minutes: estimateMinutes(km, transportation),
            transportation
          }
          computed += 1
        }
        prevPoint = point
        prevItem = item
      }
    }
    segments.value = result
    distanceComputed.value = true
    if (computed === 0) {
      ElMessage.warning('没有取到地点坐标，请确认后端已配置高德 Key')
    } else {
      ElMessage.success(`已估算 ${computed} 段路程`)
    }
  } finally {
    distanceLoading.value = false
  }
}

const totalItems = computed(() =>
  days.value.reduce((sum, day) => sum + (day.items?.length || 0), 0)
)

function sortedItems(day: TripDay): ItineraryItem[] {
  return [...(day.items || [])].sort((a, b) => a.sortOrder - b.sortOrder)
}

async function loadDays() {
  loading.value = true
  try {
    const result = await itineraryApi.days(props.trip.tripId)
    days.value = result.days || []
    // 行程变化后旧的估算结果失效，需要重新计算
    segments.value = {}
    distanceComputed.value = false
  } catch {
    days.value = []
  } finally {
    loading.value = false
  }
}

function openAdd(day: TripDay) {
  editingDate.value = day.date
  editingItem.value = null
  nextSortOrder.value = sortedItems(day).length + 1
  dialogVisible.value = true
}

function openEdit(day: TripDay, item: ItineraryItem) {
  editingDate.value = day.date
  editingItem.value = item
  nextSortOrder.value = item.sortOrder
  dialogVisible.value = true
}

async function handleDelete(item: ItineraryItem) {
  try {
    await ElMessageBox.confirm(`确定删除行程项「${item.itemName}」吗？`, '删除行程', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch {
    return
  }
  try {
    await itineraryApi.deleteItem(item.itemId)
    ElMessage.success('行程项已删除')
    loadDays()
  } catch {
    // 拦截器已提示
  }
}

async function move(day: TripDay, index: number, offset: number) {
  const items = sortedItems(day)
  const target = index + offset
  if (target < 0 || target >= items.length) return

  const reordered = [...items]
  const [moved] = reordered.splice(index, 1)
  reordered.splice(target, 0, moved)

  reordering.value = true
  try {
    const updated = await itineraryApi.reorder(
      props.trip.tripId,
      day.date,
      reordered.map((item) => item.itemId)
    )
    const targetDay = days.value.find((d) => d.date === day.date)
    if (targetDay) targetDay.items = updated
    ElMessage.success('顺序已更新')
  } catch {
    loadDays()
  } finally {
    reordering.value = false
  }
}

watch(() => [props.trip.tripId, props.trip.startDate, props.trip.endDate], loadDays)
onMounted(loadDays)
</script>

<style scoped>
.itinerary-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  gap: 12px;
}

.day-card {
  border-radius: 10px;
  border: 1px solid var(--tp-border);
  margin-bottom: 14px;
}

.day-card :deep(.el-card__header) {
  padding: 12px 16px;
  background: #f8faff;
}

.day-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.day-card__title {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.day-card__badge {
  background: var(--tp-primary);
  color: #fff;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
}

.day-card__date {
  font-weight: 600;
}

.day-card__empty {
  padding: 10px 4px;
  color: var(--tp-text-secondary);
  font-size: 13px;
}

.item-list {
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 12px 4px;
  border-bottom: 1px dashed var(--tp-border);
}

.itinerary-panel__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.item-segment {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin: 2px 0 2px 134px;
  padding: 4px 10px;
  border-left: 2px dashed #c9d8f7;
  font-size: 12px;
  color: #5b6b85;
  background: #f7faff;
  border-radius: 0 6px 6px 0;
}

.item-segment b {
  color: var(--tp-primary);
  font-weight: 600;
}

.item-segment__tip {
  color: #9aa7bd;
}

.item-segment__idle {
  color: #9aa7bd;
}

@media (max-width: 768px) {
  .item-segment {
    margin-left: 0;
  }
}

.item:last-child {
  border-bottom: none;
}

.item__time {
  width: 120px;
  flex: 0 0 120px;
  font-size: 13px;
  color: var(--tp-text-secondary);
  font-variant-numeric: tabular-nums;
  padding-top: 2px;
}

.item__main {
  flex: 1;
  min-width: 0;
}

.item__name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.item__meta {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: 6px;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.item__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.item__note {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .item {
    flex-wrap: wrap;
  }
  .item__time {
    width: 100%;
    flex: 1 1 100%;
  }
  .item__actions {
    margin-left: auto;
  }
}
</style>
