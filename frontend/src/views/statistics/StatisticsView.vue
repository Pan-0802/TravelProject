<template>
  <div class="page" v-loading="loading">
    <div class="page-header">
      <div>
        <h1 class="page-title">数据统计</h1>
        <p class="page-subtitle">
          仅统计数据库中的真实旅行与消费数据；AI 预估费用不计入实际支出。
        </p>
      </div>
      <el-button :icon="Refresh" text @click="loadAll">刷新</el-button>
    </div>

    <RequestError :message="failure" :loading="loading" @retry="loadAll"/>
    <div v-show="!failure">
    <!-- 总览 -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card__label">旅行总数</div>
        <div class="stat-card__value">{{ overview?.totalTrips ?? 0 }}</div>
        <div class="stat-card__extra">
          进行中 {{ overview?.ongoingTrips ?? 0 }} · 未开始 {{ overview?.upcomingTrips ?? 0 }} · 已结束
          {{ overview?.finishedTrips ?? 0 }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">累计规划天数</div>
        <div class="stat-card__value">{{ overview?.totalTravelDays ?? 0 }} 天</div>
        <div class="stat-card__extra">按各旅行起止日期求和</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">实际支出</div>
        <div class="stat-card__value">{{ money(overview?.totalActualExpense ?? 0) }}</div>
        <div class="stat-card__extra">全部消费记录合计</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__label">总预算</div>
        <div class="stat-card__value">{{ money(overview?.totalBudget ?? 0) }}</div>
        <div class="stat-card__extra">
          <span :class="{ 'tp-money--over': budgetUsage > 100 }">使用率 {{ budgetUsage }}%</span>
        </div>
      </div>
    </div>

    <div class="chart-grid">
      <!-- 消费分类饼图 -->
      <div class="tp-card tp-card__body">
        <div class="chart-head">
          <div>
            <h2 class="chart-title">消费分类占比</h2>
            <p class="chart-sub">合计 {{ money(categoryStats?.totalAmount ?? 0) }}</p>
          </div>
          <el-select
            v-model="categoryTripId"
            placeholder="全部旅行"
            clearable
            style="width: 220px"
            @change="loadCategories"
          >
            <el-option
              v-for="trip in trips"
              :key="trip.tripId"
              :label="trip.title"
              :value="trip.tripId"
            />
          </el-select>
        </div>
        <div v-if="categoryEmpty" class="chart-empty">该范围内还没有消费记录</div>
        <div v-show="!categoryEmpty" ref="pieRef" class="chart-box"></div>
      </div>

      <!-- 旅行费用对比 -->
      <div class="tp-card tp-card__body">
        <div class="chart-head">
          <div>
            <h2 class="chart-title">旅行费用对比</h2>
            <p class="chart-sub">按最近创建的旅行统计实际支出</p>
          </div>
        </div>
        <div v-if="!costItems.length" class="chart-empty">还没有旅行消费数据</div>
        <div v-show="costItems.length" ref="barRef" class="chart-box"></div>
      </div>
    </div>

    <!-- 预算执行对比 -->
    <div class="tp-card tp-card__body">
      <div class="chart-head">
        <div>
          <h2 class="chart-title">预算执行对比</h2>
          <p class="chart-sub">每次旅行的预算与实际消费（红色标注超预算）</p>
        </div>
      </div>
      <div v-if="!comparisonItems.length" class="chart-empty">还没有可用于对比的旅行</div>
      <div v-show="comparisonItems.length" ref="compareRef" class="chart-box chart-box--tall"></div>
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import RequestError from "@/components/common/RequestError.vue"
import {errorMessage} from "@/utils/request"
import { computed, onMounted, ref } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { statisticsApi } from '@/api/statistics'
import { tripApi } from '@/api/trip'
import { EXPENSE_CATEGORIES } from '@/constants'
import { useEcharts } from '@/composables/useEcharts'
import type {
  BudgetComparisonItem,
  CategoryStatistics,
  ExpenseCategory,
  StatisticsOverview,
  Trip,
  TripCostItem
} from '@/types/api'
import { money } from '@/utils/format'

const loading = ref(false)
const failure=ref('')
const overview = ref<StatisticsOverview | null>(null)
const categoryStats = ref<CategoryStatistics | null>(null)
const costItems = ref<TripCostItem[]>([])
const comparisonItems = ref<BudgetComparisonItem[]>([])
const trips = ref<Trip[]>([])
const categoryTripId = ref('')

const pieRef = ref<HTMLElement | null>(null)
const barRef = ref<HTMLElement | null>(null)
const compareRef = ref<HTMLElement | null>(null)

const pie = useEcharts(pieRef)
const bar = useEcharts(barRef)
const compare = useEcharts(compareRef)

const categoryEmpty = computed(() => !categoryStats.value || categoryStats.value.items.length === 0)

const budgetUsage = computed(() => {
  const total = overview.value?.totalBudget || 0
  if (!total) return 0
  return Number((((overview.value?.totalActualExpense || 0) / total) * 100).toFixed(1))
})

function categoryColor(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.color || '#8c98a8'
}

async function loadOverview() {
  try {
    overview.value = await statisticsApi.overview()
  } catch(e) {
    failure.value=errorMessage(e)
  }
}

async function loadCategories() {
  try {
    categoryStats.value = await statisticsApi.expenseCategories(categoryTripId.value || undefined)
    renderPie()
  } catch(e) {
    failure.value=errorMessage(e)
  }
}

async function loadCosts() {
  try {
    const result = await statisticsApi.tripCosts(10)
    costItems.value = result.items
    renderBar()
  } catch(e) {
    failure.value=errorMessage(e)
  }
}

async function loadComparison() {
  try {
    const result = await statisticsApi.budgetComparison(10)
    comparisonItems.value = result.items
    renderCompare()
  } catch(e) {
    failure.value=errorMessage(e)
  }
}

async function loadTrips() {
  try {
    trips.value = await tripApi.options()
  } catch(e) {
    failure.value=errorMessage(e)
  }
}

function renderPie() {
  const stats = categoryStats.value
  if (!stats || stats.items.length === 0) return
  pie.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 元 ({d}%)' },
    legend: { bottom: 0, icon: 'circle', itemWidth: 10, itemHeight: 10 },
    series: [
      {
        name: '消费分类',
        type: 'pie',
        radius: ['40%', '64%'],
        center: ['50%', '44%'],
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%' },
        data: stats.items.map((item) => ({
          name: item.name || item.category,
          value: item.amount,
          itemStyle: { color: categoryColor(item.category) }
        }))
      }
    ]
  })
}

function renderBar() {
  if (!costItems.value.length) return
  const titles = costItems.value.map((item) => item.title)
  bar.setOption({
    grid: { left: 8, right: 20, top: 30, bottom: 10, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value} 元` },
    xAxis: {
      type: 'category',
      data: titles,
      axisLabel: { interval: 0, rotate: titles.length > 5 ? 25 : 0, fontSize: 14 },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', name: '元', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: '实际支出',
        type: 'bar',
        barMaxWidth: 42,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#6ea4ff' },
              { offset: 1, color: '#3f7ef7' }
            ]
          }
        },
        data: costItems.value.map((item) => item.actualExpense)
      }
    ]
  })
}

function renderCompare() {
  if (!comparisonItems.value.length) return
  const titles = comparisonItems.value.map((item) => item.title)
  compare.setOption({
    grid: { left: 8, right: 20, top: 46, bottom: 10, containLabel: true },
    tooltip: { trigger: 'axis', valueFormatter: (value: number) => `${value} 元` },
    legend: { top: 0 },
    xAxis: {
      type: 'category',
      data: titles,
      axisLabel: { interval: 0, rotate: titles.length > 5 ? 25 : 0, fontSize: 14 },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', name: '元', splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      {
        name: '预算',
        type: 'bar',
        barMaxWidth: 26,
        itemStyle: { color: '#c9d8f7', borderRadius: [4, 4, 0, 0] },
        data: comparisonItems.value.map((item) => item.totalBudget)
      },
      {
        name: '实际支出',
        type: 'bar',
        barMaxWidth: 26,
        data: comparisonItems.value.map((item) => ({
          value: item.actualExpense,
          itemStyle: { color: item.overBudget ? '#e6483d' : '#3f7ef7', borderRadius: [4, 4, 0, 0] }
        }))
      }
    ]
  })
}

async function loadAll() {
  failure.value=''
  loading.value = true
  try {
    await Promise.all([loadOverview(), loadCategories(), loadCosts(), loadComparison(), loadTrips()])
  } finally {
    loading.value = false
  }
}

onMounted(loadAll)
</script>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
  gap:16px;
  margin:16px 0;
}

.chart-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap:12px;
  margin-bottom:8px;
  flex-wrap: wrap;
}

.chart-title {
  margin:0 0 4px;
  font-size: var(--tp-font-body);
  font-weight: 600;
}

.chart-sub {
  margin:0;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
}

.chart-empty {
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}

.chart-box--tall {
  height: 380px;
}

@media (max-width: 768px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
</style>
