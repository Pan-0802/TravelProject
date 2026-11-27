<template>
  <div class="expense-panel">
    <div class="tp-toolbar">
      <el-select
        v-model="query.category"
        placeholder="全部类别"
        clearable
        style="width: 150px"
        @change="handleSearch"
      >
        <el-option
          v-for="item in EXPENSE_CATEGORIES"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>

      <el-date-picker
        v-model="dateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        :disabled-date="isDisabledDate"
        style="width: 260px"
        @change="handleSearch"
      />

      <el-button text @click="handleReset">重置</el-button>
      <div class="tp-toolbar__spacer"></div>
      <el-button :icon="Refresh" text @click="loadExpenses">刷新</el-button>
      <el-button type="primary" :icon="Plus" @click="openCreate">记录消费</el-button>
    </div>

    <RequestError :message="failure" :loading="loading" @retry="loadExpenses"/>
    <el-table
      v-if="!failure"
      v-loading="loading"
      :data="expenses"
      stripe
      :empty-text="emptyText"
      row-key="expenseId"
    >
      <el-table-column label="日期" width="130" prop="spentOn" align="right" />
      <el-table-column label="类别" width="110">
        <template #default="{ row }">
          <el-tag :color="categoryColor(row.category)" effect="plain" class="cat-tag">
            {{ categoryLabel(row.category) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="140" align="right">
        <template #default="{ row }">
          <span class="tp-money">{{ money(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="200" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.description || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="88" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty :description="emptyText"><el-button @click="handleReset">清空条件</el-button></el-empty></template>
    </el-table>

    <ListPagination v-if="!failure" :page="query.page" :total="total" @change="page=>{query.page=page;loadExpenses()}"/>
    <ExpenseDetailDialog v-model="detailVisible" :expense="detailExpense" :trip="trip" @changed="handleChanged"/>

    <ExpenseFormDialog
      v-model="dialogVisible"
      :trip="trip"
      :expense="editingExpense"
      @saved="handleSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import dayjs from 'dayjs'

import { Plus, Refresh } from '@element-plus/icons-vue'
import { expenseApi } from '@/api/expense'
import ExpenseFormDialog from '@/components/expense/ExpenseFormDialog.vue'
import ExpenseDetailDialog from './ExpenseDetailDialog.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import RequestError from '@/components/common/RequestError.vue'
import {errorMessage} from '@/utils/request'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/constants'
import type { Expense, ExpenseCategory, Trip } from '@/types/api'
import { money } from '@/utils/format'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const expenses = ref<Expense[]>([])
const total = ref(0)
const loading = ref(false)
const failure=ref(''),detailVisible=ref(false),detailExpense=ref<Expense|null>(null)
let sequence=0
const dialogVisible = ref(false)
const editingExpense = ref<Expense | null>(null)
const dateRange = ref<[string, string] | null>(null)

const query = reactive({
  page: 1,
  size: 20,
  category: '' as ExpenseCategory | ''
})

const emptyText = computed(() =>
  query.category || dateRange.value ? '没有匹配的记录，请调整或清空检索条件' : '还没有消费记录，点击“记录消费”开始记账'
)

function categoryLabel(category: ExpenseCategory) {
  return EXPENSE_CATEGORY_LABELS[category] || category
}

function categoryColor(category: ExpenseCategory) {
  const found = EXPENSE_CATEGORIES.find((item) => item.value === category)
  return found ? `${found.color}1a` : '#f0f2f5'
}

function isDisabledDate(date: Date) {
  const d = dayjs(date).format('YYYY-MM-DD')
  return d < props.trip.startDate || d > props.trip.endDate
}

async function loadExpenses() {
  const run=++sequence
  loading.value = true
  failure.value=''
  try {
    const result = await expenseApi.list(props.trip.tripId, {
      page: query.page,
      size: query.size,
      category: query.category,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1]
    })
    if(run!==sequence)return
    expenses.value = result.list
    total.value = result.total
  } catch(e) {
    if(run===sequence)failure.value=errorMessage(e)
  } finally {
    if(run===sequence)loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadExpenses()
}

function handleReset() {
  query.category = ''
  dateRange.value = null
  handleSearch()
}

function handleSizeChange() {
  query.page = 1
  loadExpenses()
}

function openCreate() {
  editingExpense.value = null
  dialogVisible.value = true
}

function openDetail(expense:Expense){detailExpense.value=expense;detailVisible.value=true}
function handleSaved(expense:Expense,created:boolean){
  handleChanged()
  if(created)openDetail(expense)
}
function handleChanged(){loadExpenses();emit('changed')}

watch(() => props.trip.tripId, loadExpenses)
onMounted(loadExpenses)
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top:16px;
}

.cat-tag {
  border-style: solid;
  color:var(--tp-primary);
}
</style>
