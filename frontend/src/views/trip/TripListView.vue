<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">旅行计划</h1>
        <p class="page-subtitle">
          管理你的所有旅行：创建计划、查看每日行程、记录消费。共 {{ total }} 条记录。
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新建旅行</el-button>
    </div>

    <div class="tp-card tp-card__body">
      <div class="tp-toolbar">
        <el-input
          v-model.trim="query.keyword"
          placeholder="搜索旅行名称 / 目的地"
          clearable
          style="width: 240px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <el-select v-model="query.status" placeholder="全部状态" clearable style="width: 140px" @change="handleSearch">
          <el-option label="未开始" value="NOT_STARTED" />
          <el-option label="进行中" value="ONGOING" />
          <el-option label="已结束" value="FINISHED" />
        </el-select>
        <el-button @click="handleSearch">查询</el-button>
        <el-button text @click="handleReset">重置</el-button>
        <div class="tp-toolbar__spacer"></div>
        <el-button :icon="Refresh" text @click="loadTrips">刷新</el-button>
      </div>

      <el-table
        v-loading="loading"
        :data="trips"
        row-key="tripId"
        stripe
        :empty-text="emptyText"
        @row-dblclick="(row: Trip) => goDetail(row.tripId)"
      >
        <el-table-column label="旅行" min-width="220">
          <template #default="{ row }">
            <div class="trip-title">{{ row.title }}</div>
            <div class="trip-dest">
              <el-icon><Location /></el-icon>{{ row.destination }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="日期" min-width="210">
          <template #default="{ row }">
            <div>{{ row.startDate }} 至 {{ row.endDate }}</div>
            <div class="tp-muted">共 {{ row.daysCount }} 天</div>
          </template>
        </el-table-column>

        <el-table-column label="预算 / 支出" min-width="170">
          <template #default="{ row }">
            <div class="tp-money">{{ money(row.totalBudget) }}</div>
            <div class="tp-muted">
              已支出
              <span :class="['tp-money', { 'tp-money--over': row.actualExpense > row.totalBudget }]">
                {{ money(row.actualExpense) }}
              </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.tripStatus)" effect="light">
              {{ statusLabel(row.tripStatus) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row.tripId)">详情</el-button>
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @current-change="loadTrips"
          @size-change="handleSizeChange"
        />
      </div>
    </div>

    <TripFormDialog v-model="dialogVisible" :trip="editingTrip" @saved="handleSaved" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Location, Plus, Refresh, Search } from '@element-plus/icons-vue'
import { tripApi } from '@/api/trip'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'
import { TRIP_STATUS_LABELS, TRIP_STATUS_TAG_TYPE } from '@/constants'
import type { Trip, TripStatus } from '@/types/api'
import { money } from '@/utils/format'

const router = useRouter()

const trips = ref<Trip[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const editingTrip = ref<Trip | null>(null)

const query = reactive({
  page: 1,
  size: 10,
  keyword: '',
  status: '' as TripStatus | ''
})

const emptyText = computed(() =>
  query.keyword || query.status ? '没有符合筛选条件的旅行' : '还没有旅行计划，点击“新建旅行”开始吧'
)

function statusLabel(status: TripStatus) {
  return TRIP_STATUS_LABELS[status] || status
}

function statusTagType(status: TripStatus) {
  return TRIP_STATUS_TAG_TYPE[status] || 'info'
}

async function loadTrips() {
  loading.value = true
  try {
    const result = await tripApi.list({
      page: query.page,
      size: query.size,
      keyword: query.keyword,
      status: query.status
    })
    trips.value = result.list
    total.value = result.total
  } catch {
    trips.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadTrips()
}

function handleReset() {
  query.keyword = ''
  query.status = ''
  handleSearch()
}

function handleSizeChange() {
  query.page = 1
  loadTrips()
}

function openCreate() {
  editingTrip.value = null
  dialogVisible.value = true
}

function openEdit(trip: Trip) {
  editingTrip.value = trip
  dialogVisible.value = true
}

function handleSaved() {
  loadTrips()
}

function goDetail(tripId: string) {
  router.push(`/trips/${tripId}`)
}

async function handleDelete(trip: Trip) {
  try {
    await ElMessageBox.confirm(
      `删除「${trip.title}」后，该旅行下的每日行程与消费记录会一并删除，且无法恢复。确定继续吗？`,
      '删除旅行',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消', confirmButtonClass: 'el-button--danger' }
    )
  } catch {
    return
  }

  try {
    await tripApi.remove(trip.tripId)
    ElMessage.success('旅行已删除')
    if (trips.value.length === 1 && query.page > 1) query.page -= 1
    loadTrips()
  } catch {
    // 404/403 等由拦截器提示
  }
}

onMounted(loadTrips)
</script>

<style scoped>
.trip-title {
  font-weight: 600;
  line-height: 1.5;
}

.trip-dest {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--tp-text-secondary);
  margin-top: 2px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
