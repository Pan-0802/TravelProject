<template>
  <div class="page">
    <div class="page-header">
      <div>
        <el-button link :icon="ArrowLeft" class="back-btn" @click="router.push('/trips')">
          返回旅行列表
        </el-button>
        <h1 class="page-title">{{ trip?.title || '旅行详情' }}</h1>
        <p class="page-subtitle" v-if="trip">
          <el-icon><Location /></el-icon>
          {{ trip.destination }}
          <span class="dot">·</span>
          {{ dateRange(trip.startDate, trip.endDate) }}
          <span class="dot">·</span>
          共 {{ trip.daysCount }} 天
          <el-tag :type="statusTagType(trip.tripStatus)" size="small" effect="light" class="status-tag">
            {{ statusLabel(trip.tripStatus) }}
          </el-tag>
        </p>
      </div>

      <div class="header-actions" v-if="trip">
        <el-button :icon="Edit" @click="editVisible = true">编辑旅行</el-button>
        <el-button type="primary" :icon="MagicStick" @click="goAiPlanner">用 AI 规划行程</el-button>
      </div>
    </div>

    <el-result
      v-if="notFound"
      icon="warning"
      title="旅行不存在"
      sub-title="该旅行可能已被删除，或不属于当前账号。"
    >
      <template #extra>
        <el-button type="primary" @click="router.replace('/trips')">返回旅行列表</el-button>
      </template>
    </el-result>

    <template v-else>
      <div class="stat-grid budget-cards" v-if="trip">
        <div class="stat-card">
          <div class="stat-card__label">总预算</div>
          <div class="stat-card__value">{{ money(trip.totalBudget) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">已支出</div>
          <div class="stat-card__value">{{ money(budget?.actualExpense ?? trip.actualExpense) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">剩余预算</div>
          <div class="stat-card__value" :class="{ 'tp-money--over': overBudget }">
            {{ money(budget?.remainingBudget ?? trip.totalBudget - trip.actualExpense) }}
          </div>
          <div class="stat-card__extra" v-if="overBudget">已超预算</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">行程天数</div>
          <div class="stat-card__value">{{ trip.daysCount }} 天</div>
          <div class="stat-card__extra">{{ trip.destination }}</div>
        </div>
      </div>

      <div class="tp-card tabs-card" v-loading="loading">
        <el-tabs v-model="activeTab" class="detail-tabs">
          <el-tab-pane label="每日行程" name="itinerary">
            <div class="tab-body">
              <ItineraryPanel v-if="trip" :trip="trip" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="消费记录" name="expense" lazy>
            <div class="tab-body">
              <ExpensePanel v-if="trip" :trip="trip" @changed="loadBudget" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="预算统计" name="budget" lazy>
            <div class="tab-body">
              <TripBudgetPanel v-if="trip" :trip="trip" :summary="budget" :loading="budgetLoading" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <TripFormDialog v-if="trip" v-model="editVisible" :trip="trip" @saved="handleSaved" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Edit, Location, MagicStick } from '@element-plus/icons-vue'
import { tripApi } from '@/api/trip'
import { expenseApi } from '@/api/expense'
import ItineraryPanel from '@/components/itinerary/ItineraryPanel.vue'
import ExpensePanel from '@/components/expense/ExpensePanel.vue'
import TripBudgetPanel from '@/components/trip/TripBudgetPanel.vue'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'
import { TRIP_STATUS_LABELS, TRIP_STATUS_TAG_TYPE } from '@/constants'
import type { BudgetSummary, Trip, TripStatus } from '@/types/api'
import { dateRange, money } from '@/utils/format'
import { errorCode } from '@/utils/request'

const route = useRoute()
const router = useRouter()

const trip = ref<Trip | null>(null)
const budget = ref<BudgetSummary | null>(null)
const loading = ref(false)
const budgetLoading = ref(false)
const notFound = ref(false)
const editVisible = ref(false)
const activeTab = ref<'itinerary' | 'expense' | 'budget'>('itinerary')

const tripId = computed(() => String(route.params.tripId || ''))

const overBudget = computed(() => {
  if (budget.value) return budget.value.overBudget
  if (!trip.value) return false
  return trip.value.totalBudget - trip.value.actualExpense < 0
})

function statusLabel(status: TripStatus) {
  return TRIP_STATUS_LABELS[status] || status
}

function statusTagType(status: TripStatus) {
  return TRIP_STATUS_TAG_TYPE[status] || 'info'
}

async function loadTrip() {
  loading.value = true
  notFound.value = false
  try {
    trip.value = await tripApi.detail(tripId.value)
  } catch (error) {
    if (errorCode(error) === 40400 || (error as { status?: number }).status === 404) {
      notFound.value = true
      trip.value = null
    }
  } finally {
    loading.value = false
  }
}

async function loadBudget() {
  if (!tripId.value) return
  budgetLoading.value = true
  try {
    budget.value = await expenseApi.budgetSummary(tripId.value)
  } catch {
    budget.value = null
  } finally {
    budgetLoading.value = false
  }
}

function handleSaved() {
  loadTrip()
  loadBudget()
}

function goAiPlanner() {
  router.push({ path: '/ai', query: { tripId: trip.value?.tripId } })
}

function refresh() {
  loadTrip()
  loadBudget()
}

watch(tripId, refresh)
onMounted(refresh)
</script>

<style scoped>
.back-btn {
  margin-bottom: 6px;
  padding-left: 0;
}

.header-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dot {
  color: #c3ccda;
}

.status-tag {
  margin-left: 4px;
}

.budget-cards {
  margin-bottom: 16px;
}

.tabs-card {
  padding: 6px 18px 18px;
}

.tab-body {
  padding-top: 6px;
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom: 14px;
}

@media (max-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
