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

    <el-table
      v-loading="loading"
      :data="expenses"
      stripe
      :empty-text="emptyText"
      row-key="expenseId"
    >
      <el-table-column label="日期" width="130" prop="spentOn" />
      <el-table-column label="类别" width="110">
        <template #default="{ row }">
          <el-tag :color="categoryColor(row.category)" effect="plain" class="cat-tag">
            {{ categoryLabel(row.category) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="140">
        <template #default="{ row }">
          <span class="tp-money">{{ money(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="说明" min-width="200">
        <template #default="{ row }">
          {{ row.description || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130" fixed="right">
        <template #default="{ row }">
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
        layout="total, sizes, prev, pager, next"
        background
        @current-change="loadExpenses"
        @size-change="handleSizeChange"
      />
    </div>

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
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Refresh } from '@element-plus/icons-vue'
import { expenseApi } from '@/api/expense'
import ExpenseFormDialog from '@/components/expense/ExpenseFormDialog.vue'
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_LABELS } from '@/constants'
import type { Expense, ExpenseCategory, Trip } from '@/types/api'
import { money } from '@/utils/format'

const props = defineProps<{ trip: Trip }>()
const emit = defineEmits<{ (e: 'changed'): void }>()

const expenses = ref<Expense[]>([])
const total = ref(0)
const loading = ref(false)
const dialogVisible = ref(false)
const editingExpense = ref<Expense | null>(null)
const dateRange = ref<[string, string] | null>(null)

const query = reactive({
  page: 1,
  size: 10,
  category: '' as ExpenseCategory | ''
})

const emptyText = computed(() =>
  query.category || dateRange.value ? '没有符合筛选条件的消费记录' : '还没有消费记录，点击“记录消费”开始记账'
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
  loading.value = true
  try {
    const result = await expenseApi.list(props.trip.tripId, {
      page: query.page,
      size: query.size,
      category: query.category,
      startDate: dateRange.value?.[0],
      endDate: dateRange.value?.[1]
    })
    expenses.value = result.list
    total.value = result.total
  } catch {
    expenses.value = []
    total.value = 0
  } finally {
    loading.value = false
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

function openEdit(expense: Expense) {
  editingExpense.value = expense
  dialogVisible.value = true
}

function handleSaved() {
  loadExpenses()
  emit('changed')
}

async function handleDelete(expense: Expense) {
  try {
    await ElMessageBox.confirm(
      `确定删除 ${expense.spentOn} 的「${categoryLabel(expense.category)} ${money(expense.amount)}」吗？`,
      '删除消费',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await expenseApi.remove(expense.expenseId)
    ElMessage.success('消费记录已删除')
    if (expenses.value.length === 1 && query.page > 1) query.page -= 1
    handleSaved()
  } catch {
    // 拦截器已提示
  }
}

watch(() => props.trip.tripId, loadExpenses)
onMounted(loadExpenses)
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.cat-tag {
  border-style: solid;
  color: #33415c;
}
</style>
