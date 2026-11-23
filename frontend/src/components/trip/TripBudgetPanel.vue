<template>
  <div v-loading="loading" class="budget-panel">
    <div v-if="!summary" class="tp-empty">暂无预算数据</div>

    <template v-else>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-card__label">总预算</div>
          <div class="stat-card__value">{{ money(summary.totalBudget) }}</div>
          <div class="stat-card__extra">行程 {{ trip.daysCount }} 天</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">已支出</div>
          <div class="stat-card__value">{{ money(summary.actualExpense) }}</div>
          <div class="stat-card__extra">
            执行率 {{ usagePercent }}%
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">剩余预算</div>
          <div class="stat-card__value" :class="{ 'tp-money--over': summary.overBudget }">
            {{ money(summary.remainingBudget) }}
          </div>
          <div class="stat-card__extra">
            <el-tag v-if="summary.overBudget" type="danger" size="small" effect="plain">已超预算</el-tag>
            <span v-else>预算充足</span>
          </div>
        </div>
      </div>

      <el-progress
        class="budget-progress"
        :percentage="progressPercent"
        :status="summary.overBudget ? 'exception' : 'success'"
        :stroke-width="14"
        :format="() => `已使用 ${money(summary?.actualExpense)}`"
      />

      <div class="budget-grid">
        <div class="tp-card tp-card__body">
          <h3 class="budget-title">消费分类占比</h3>
          <div v-if="summary.categoryTotals.length === 0" class="tp-empty">还没有消费记录</div>
          <div v-else ref="chartRef" class="chart-box"></div>
        </div>

        <div class="tp-card tp-card__body">
          <h3 class="budget-title">分类明细</h3>
          <div v-if="summary.categoryTotals.length === 0" class="tp-empty">还没有消费记录</div>
          <el-table v-else :data="summary.categoryTotals" size="small" :show-header="true">
            <el-table-column label="类别" width="100">
              <template #default="{ row }">{{ categoryLabel(row.category) }}</template>
            </el-table-column>
            <el-table-column label="金额" width="120">
              <template #default="{ row }">{{ money(row.amount) }}</template>
            </el-table-column>
            <el-table-column label="占比">
              <template #default="{ row }">
                <el-progress
                  :percentage="percentOf(row.amount)"
                  :stroke-width="8"
                  :show-text="false"
                  :color="categoryColor(row.category)"
                />
                <span class="tp-muted">{{ percentOf(row.amount) }}%</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/constants'
import { useEcharts } from '@/composables/useEcharts'
import type { BudgetSummary, ExpenseCategory, Trip } from '@/types/api'
import { money } from '@/utils/format'

const props = defineProps<{
  trip: Trip
  summary: BudgetSummary | null
  loading?: boolean
}>()

const chartRef = ref<HTMLElement | null>(null)
const { setOption } = useEcharts(chartRef)

const usagePercent = computed(() => {
  if (!props.summary) return 0
  if (!props.summary.totalBudget) return props.summary.actualExpense > 0 ? 100 : 0
  return Number(((props.summary.actualExpense / props.summary.totalBudget) * 100).toFixed(1))
})

const progressPercent = computed(() => Math.min(usagePercent.value, 100))

function categoryLabel(category: ExpenseCategory) {
  return EXPENSE_CATEGORY_LABELS[category] || category
}

function categoryColor(category: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((item) => item.value === category)?.color || '#8c98a8'
}

function percentOf(amount: number) {
  const totalAmount = props.summary?.actualExpense || 0
  if (!totalAmount) return 0
  return Number(((amount / totalAmount) * 100).toFixed(1))
}

function renderChart() {
  const summary = props.summary
  if (!summary || summary.categoryTotals.length === 0) return
  setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 元 ({d}%)' },
    legend: { bottom: 0, icon: 'circle' },
    series: [
      {
        name: '消费分类',
        type: 'pie',
        radius: ['42%', '66%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { formatter: '{b}\n{d}%' },
        data: summary.categoryTotals.map((item) => ({
          name: categoryLabel(item.category),
          value: item.amount,
          itemStyle: { color: categoryColor(item.category) }
        }))
      }
    ]
  })
}

watch(() => props.summary, renderChart, { deep: true, immediate: true })
</script>

<style scoped>
.budget-panel {
  min-height: 200px;
}

.budget-progress {
  margin: 18px 0 4px;
}

.budget-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.budget-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}
</style>
