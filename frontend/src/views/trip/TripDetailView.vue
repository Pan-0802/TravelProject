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
        <el-button type="danger" plain @click="deleteTrip">删除旅行</el-button>
        <el-button type="primary" :icon="MagicStick" @click="goAiPlanner">用 AI 规划行程</el-button>
      </div>
    </div>

    <RequestError :message="failure" :loading="loading" @retry="refresh" />
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
      <div class="stat-grid budget-cards" v-if="trip && !budgetFailure">
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
              <ItineraryPanel v-if="trip" :trip="trip" @record-expense="recordExpense" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="消费记录" name="expense" lazy>
            <div class="tab-body">
              <ExpensePanel v-if="trip" :key="expenseVersion" :trip="trip" @changed="loadBudget" />
            </div>
          </el-tab-pane>

          <el-tab-pane label="预算统计" name="budget" lazy>
            <div class="tab-body">
              <RequestError :message="budgetFailure" :loading="budgetLoading" @retry="loadBudget"/>
              <TripBudgetPanel v-if="trip && !budgetFailure" :trip="trip" :summary="budget" :loading="budgetLoading" />
            </div>
          </el-tab-pane>
        </el-tabs>
      </div>
    </template>

    <TripFormDialog v-if="trip" v-model="editVisible" :trip="trip" @saved="handleSaved" />
    <ExpenseDetailDialog v-if="trip" v-model="expenseDetailVisible" :expense="newExpense" :trip="trip" @changed="expenseChanged"/>
    <ExpenseFormDialog v-if="trip" v-model="expenseVisible" :trip="trip" :prefill="expenseSeed" @saved="expenseSaved"/>
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
import ExpenseFormDialog from '@/components/expense/ExpenseFormDialog.vue'
import ExpenseDetailDialog from '@/components/expense/ExpenseDetailDialog.vue'
import { TRIP_STATUS_LABELS, TRIP_STATUS_TAG_TYPE } from '@/constants'
import type { BudgetSummary, Trip, TripStatus, ItineraryItem, Expense } from '@/types/api'
import { dateRange, money } from '@/utils/format'
import { errorCode, errorMessage } from '@/utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'
import RequestError from '@/components/common/RequestError.vue'

const route = useRoute()
const router = useRouter()

const trip = ref<Trip | null>(null)
const budget = ref<BudgetSummary | null>(null)
const loading = ref(false)
const budgetLoading = ref(false)
const budgetFailure=ref('')
const notFound = ref(false)
const failure=ref('')
const editVisible = ref(false)
const activeTab = ref<'itinerary' | 'expense' | 'budget'>('itinerary')
const expenseVisible=ref(false),expenseVersion=ref(0),expenseSeed=ref<{spentOn:string;description:string}>()
function recordExpense(date:string,item:ItineraryItem){expenseSeed.value={spentOn:date,description:item.itemName};expenseVisible.value=true}
const newExpense=ref<Expense|null>(null),expenseDetailVisible=ref(false)
function expenseSaved(expense:Expense,created:boolean){expenseVersion.value++;loadBudget();activeTab.value='expense';if(created){newExpense.value=expense;expenseDetailVisible.value=true}}
function expenseChanged(){expenseVersion.value++;loadBudget()}

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
  failure.value = ''
  try {
    trip.value = await tripApi.detail(tripId.value)
  } catch (error) {
    if (errorCode(error) === 40400 || (error as { status?: number }).status === 404) {
      notFound.value = true
      trip.value = null
    } else { failure.value=errorMessage(error) }
  } finally {
    loading.value = false
  }
}

async function loadBudget() {
  if (!tripId.value) return
  budgetLoading.value = true
  budgetFailure.value=''
  try {
    budget.value = await expenseApi.budgetSummary(tripId.value)
  } catch(e) {
    budgetFailure.value=errorMessage(e)
  } finally {
    budgetLoading.value = false
  }
}

function handleSaved() { router.push('/trips') }

async function deleteTrip() {
  if(!trip.value)return
  try{await ElMessageBox.confirm(`删除「${trip.value.title}」后，每日行程与消费记录会一并删除，且无法恢复。确定继续吗？`,'删除旅行',{confirmButtonText:'删除',cancelButtonText:'取消',type:'warning'})}catch{return}
  try{await tripApi.remove(trip.value.tripId);ElMessage.success('旅行已删除');router.replace('/trips')}catch(e){failure.value=errorMessage(e)}
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
  margin-bottom:4px;
  padding-left:0;
}

.header-actions {
  display: flex;
  gap:8px;
  flex-wrap: wrap;
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap:4px;
  flex-wrap: wrap;
}

.dot {
  color:#c3ccda;
}

.status-tag {
  margin-left:4px;
}

.budget-cards {
  margin-bottom:16px;
}

.tabs-card {
  padding:4px 16px 16px;
}

.tab-body {
  padding-top:4px;
}

.detail-tabs :deep(.el-tabs__header) {
  margin-bottom:12px;
}

@media (max-width: 768px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
