<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑消费' : '记录消费'"
    width="540px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="84px">
      <el-form-item label="消费类别" prop="category">
        <el-select v-model="form.category" placeholder="请选择类别" style="width: 100%">
          <el-option
            v-for="item in EXPENSE_CATEGORIES"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          >
            <span class="cat-dot" :style="{ background: item.color }"></span>
            {{ item.label }}
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="金额" prop="amount">
        <el-input-number
          v-model="form.amount"
          :min="0.01"
          :max="9999999999.99"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 200px"
        />
        <span class="unit">元</span>
      </el-form-item>

      <el-form-item label="消费日期" prop="spentOn">
        <el-date-picker
          v-model="form.spentOn"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          :disabled-date="isDisabledDate"
          style="width: 220px"
        />
        <div class="form-tip">消费日期需落在旅行日期范围内（{{ trip.startDate }} ~ {{ trip.endDate }}）</div>
      </el-form-item>

      <el-form-item label="说明">
        <el-input
          v-model.trim="form.description"
          type="textarea"
          :rows="2"
          maxlength="300"
          show-word-limit
          placeholder="例如：午餐、地铁充值"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import dayjs from 'dayjs'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { expenseApi } from '@/api/expense'
import { EXPENSE_CATEGORIES } from '@/constants'
import type { Expense, ExpenseCategory, Trip } from '@/types/api'
import { today } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  trip: Trip
  expense?: Expense | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const isEdit = computed(() => Boolean(props.expense?.expenseId))
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  category: 'FOOD' as ExpenseCategory,
  amount: 0,
  spentOn: '',
  description: ''
})

const rules: FormRules = {
  category: [{ required: true, message: '请选择消费类别', trigger: 'change' }],
  amount: [
    {
      required: true,
      validator: (_rule, value, callback) => {
        if (!value || Number(value) <= 0) return callback(new Error('金额必须大于 0'))
        callback()
      },
      trigger: 'blur'
    }
  ],
  spentOn: [
    { required: true, message: '请选择消费日期', trigger: 'change' },
    {
      validator: (_rule, value, callback) => {
        if (!value) return callback(new Error('请选择消费日期'))
        if (value < props.trip.startDate || value > props.trip.endDate) {
          return callback(new Error('消费日期需在旅行日期范围内'))
        }
        callback()
      },
      trigger: 'change'
    }
  ]
}

function isDisabledDate(date: Date) {
  const d = dayjs(date).format('YYYY-MM-DD')
  return d < props.trip.startDate || d > props.trip.endDate
}

function handleOpen() {
  const expense = props.expense
  form.category = expense?.category || 'FOOD'
  form.amount = Number(expense?.amount ?? 0)
  form.spentOn = expense?.spentOn || defaultDate()
  form.description = expense?.description || ''
  formRef.value?.clearValidate()
}

function defaultDate() {
  const current = today()
  if (current < props.trip.startDate) return props.trip.startDate
  if (current > props.trip.endDate) return props.trip.endDate
  return current
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload = {
    category: form.category,
    amount: Number(form.amount),
    spentOn: form.spentOn,
    description: form.description || null
  }

  submitting.value = true
  try {
    if (props.expense?.expenseId) {
      await expenseApi.update(props.expense.expenseId, payload)
      ElMessage.success('消费记录已更新')
    } else {
      await expenseApi.create(props.trip.tripId, payload)
      ElMessage.success('消费记录已添加')
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch {
    // 422/400 由拦截器提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.unit {
  margin-left: 8px;
  color: var(--tp-text-secondary);
  font-size: 13px;
}

.form-tip {
  font-size: 12px;
  color: var(--tp-text-secondary);
  line-height: 1.6;
  margin-top: 4px;
}

.cat-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}
</style>
