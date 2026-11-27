<template>
  <div
    v-loading="loading"
    element-loading-text="加载行程中…"
    class="itinerary-panel"
  >
    <RequestError :message="failure" :loading="loading" @retry="loadDays"/>
    <div class="itinerary-panel__toolbar">
      <span class="tp-muted">
        共 {{ days.length }} 天行程，{{ totalItems }} 个活动。新增或修改开始时间会自动排序，也可用箭头自定义顺序。
      </span>
      <div class="itinerary-panel__actions">
        <el-button type="primary" plain @click="router.push({path:'/attractions',query:{tripId:trip.tripId}})">挑选景点加入行程</el-button>
        <el-button :icon="Refresh" text @click="loadDays">刷新</el-button>
      </div>
    </div>

    <div v-if="!failure && !loading && days.length === 0" class="tp-empty">
      暂无行程数据。确认旅行日期范围后再试。
    </div>

    <el-card
      v-for="day in days"
      :key="day.date"
      shadow="never"
      class="day-card"
      :body-style="{ padding:'12px 16px' }"
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
          <el-button v-if="needsTimeOrder(sortedItems(day))" size="small" text type="primary" :disabled="reordering" @click="arrangeByTime(day)">按时间整理</el-button>
          <el-button size="small" type="primary" plain :icon="Plus" :disabled="reordering" @click="openAdd(day)">
            添加行程
          </el-button>
        </div>
      </template>

      <div v-if="sortedItems(day).length === 0" class="day-card__empty">
        这一天还没有安排，点击右上角“添加行程”开始规划。
      </div>

      <div v-else class="item-list">
        <template v-for="(item, index) in sortedItems(day)" :key="item.itemId">
          <div class="item">
            <div class="item__time">{{ timeRange(item.startTime, item.endTime) }}</div>

            <div class="item__main">
              <div class="item__name">
                {{ item.itemName }}
                <el-tag size="small" :type="item.sourceType === 'AI' ? 'success' : 'info'" effect="plain">
                  {{ SOURCE_TYPE_LABELS[item.sourceType] || item.sourceType }}
                </el-tag>
                <el-tag v-if="conflicts.get(item.itemId)?.length" size="small" type="warning" effect="plain" :title="'与 '+conflicts.get(item.itemId)!.join('、')+' 时间重叠'">时间重叠</el-tag>
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
              <el-button text size="small" @click="emit('record-expense',day.date,item)">记消费</el-button>
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
      :city="trip.destination"
      :date="editingDate"
      :item="editingItem"
      :next-sort-order="nextSortOrder"
      :day-items="days.find(d=>d.date===editingDate)?.items || []"
      @saved="loadDays"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {useRouter} from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bottom, Plus, Refresh, Top, Van, Wallet } from '@element-plus/icons-vue'
import { itineraryApi } from '@/api/itinerary'
import ItineraryItemDialog from '@/components/itinerary/ItineraryItemDialog.vue'
import { SOURCE_TYPE_LABELS } from '@/constants'
import type { ItineraryItem, Trip, TripDay } from '@/types/api'
import { longDate, money, timeRange, weekday } from '@/utils/format'
import { byStartTime, needsTimeOrder, timeConflicts } from '@/utils/schedule'
import RequestError from '@/components/common/RequestError.vue'
import {errorMessage} from '@/utils/request'

const props = defineProps<{ trip: Trip }>()
const router=useRouter()
const emit=defineEmits<{(e:'record-expense',date:string,item:ItineraryItem):void}>()

const days = ref<TripDay[]>([])
const loading = ref(false)
const failure=ref('')
const reordering = ref(false)
const dialogVisible = ref(false)
const editingDate = ref('')
const editingItem = ref<ItineraryItem | null>(null)
const nextSortOrder = ref(1)

const totalItems = computed(() =>
  days.value.reduce((sum, day) => sum + (day.items?.length || 0), 0)
)
const conflicts = computed(() => new Map(days.value.flatMap(day => day.items.map(item =>
  [item.itemId, timeConflicts(item, day.items.filter(other => other.itemId !== item.itemId))] as const
))))

function sortedItems(day: TripDay): ItineraryItem[] {
  return [...(day.items || [])].sort((a, b) => a.sortOrder - b.sortOrder)
}

async function loadDays() {
  loading.value = true
  failure.value=''
  try {
    const result = await itineraryApi.days(props.trip.tripId)
    days.value = result.days || []
  } catch(e) {
    failure.value=errorMessage(e)
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
    await ElMessageBox.confirm(`删除行程项「${item.itemName}」后无法恢复；已记录的实际消费会保留。确定删除吗？`, '删除行程', {
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
  if (reordering.value) return
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

async function arrangeByTime(day: TripDay) {
  if (reordering.value) return
  reordering.value = true
  try {
    const updated = await itineraryApi.reorder(props.trip.tripId, day.date, byStartTime(sortedItems(day)).map(item => item.itemId))
    const target = days.value.find(d => d.date === day.date)
    if (target) target.items = updated
    ElMessage.success('当天行程已按开始时间整理，活动时间保持不变')
  } catch { /* Request layer shows errors. */ }
  finally { reordering.value = false }
}

watch(() => [props.trip.tripId, props.trip.startDate, props.trip.endDate], loadDays)
onMounted(loadDays)
</script>

<style scoped>
.itinerary-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom:12px;
  gap:12px;
}

.day-card {
  border-radius: 10px;
  border: 1px solid var(--tp-border);
  margin-bottom:12px;
}

.day-card :deep(.el-card__header) {
  padding:12px 16px;
  background: #f8faff;
}

.day-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap:12px;
  flex-wrap: wrap;
}

.day-card__title {
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
}

.day-card__badge {
  background: var(--tp-primary);
  color:#ffffff;
  border-radius: 6px;
  padding:4px 8px;
  font-size: var(--tp-font-body);
  font-weight: 600;
}

.day-card__date {
  font-weight: 600;
}

.day-card__empty {
  padding:8px 4px;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}

.item-list {
  display: flex;
  flex-direction: column;
}

.item {
  display: flex;
  align-items: flex-start;
  gap:12px;
  padding:12px 4px;
  border-bottom: 1px dashed var(--tp-border);
}

.itinerary-panel__actions {
  display: flex;
  align-items: center;
  gap:4px;
  flex-shrink: 0;
}

.item-segment {
  display: flex;
  align-items: center;
  gap:4px;
  flex-wrap: wrap;
  margin:4px 0 4px 24px;
  padding:4px 8px;
  border-left: 2px dashed #c9d8f7;
  font-size: var(--tp-font-body);
  color:var(--tp-primary);
  background: #f7faff;
  border-radius: 0 6px 6px 0;
}

.item-segment b {
  color: var(--tp-primary);
  font-weight: 600;
}

.item-segment__tip {
  color:var(--tp-text-secondary);
}

.item-segment__idle {
  color:var(--tp-text-secondary);
}

@media (max-width: 768px) {
  .item-segment {
    margin-left:0;
  }
}

.item:last-child {
  border-bottom: none;
}

.item__time {
  width: 120px;
  flex: 0 0 120px;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
  font-variant-numeric: tabular-nums;
  padding-top:4px;
}

.item__main {
  flex: 1;
  min-width: 0;
}

.item__name {
  font-weight: 600;
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
}

.item__meta {
  display: flex;
  align-items: center;
  gap:12px;
  flex-wrap: wrap;
  margin-top:4px;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
}

.item__meta span {
  display: inline-flex;
  align-items: center;
  gap:4px;
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
    margin-left:auto;
  }
}
</style>
