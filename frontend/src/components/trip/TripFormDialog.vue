<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑旅行' : '新建旅行'"
    width="560px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="旅行名称" prop="title">
        <el-input v-model.trim="form.title" maxlength="120" show-word-limit placeholder="例如：重庆三日游" />
      </el-form-item>

      <el-form-item label="目的地" prop="destination">
        <el-input v-model.trim="form.destination" maxlength="120" placeholder="例如：重庆" />
      </el-form-item>

      <el-form-item label="出行日期" prop="dateRange">
        <el-date-picker
          v-model="form.dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 100%"
        />
        <div class="form-tip">开始、结束日期均计入行程，共 {{ formDaysCount }} 天</div>
      </el-form-item>

      <el-form-item label="预算" prop="totalBudget">
        <el-input-number
          v-model="form.totalBudget"
          :min="0"
          :max="9999999999.99"
          :precision="2"
          :step="100"
          controls-position="right"
          style="width: 220px"
        />
        <span class="form-tip form-tip--inline">元</span>
      </el-form-item>

      <el-alert
        v-if="isEdit"
        type="info"
        :closable="false"
        show-icon
        title="修改日期时，若已有行程或消费落在新日期范围之外，后端会拒绝保存（42200），请先调整子数据。"
      />
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { tripApi } from '@/api/trip'
import type { Trip, TripPayload } from '@/types/api'
import { daysBetween } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  trip?: Trip | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', trip: Trip): void
}>()

const isEdit = computed(() => Boolean(props.trip?.tripId))
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  title: '',
  destination: '',
  dateRange: [] as string[],
  totalBudget: 0
})

const formDays = computed(() => daysBetween(form.dateRange?.[0], form.dateRange?.[1]))
const formDaysCount = computed(() => formDays.value)

const rules: FormRules = {
  title: [
    { required: true, message: '请输入旅行名称', trigger: 'blur' },
    { min: 1, max: 120, message: '旅行名称长度为 1-120 个字符', trigger: 'blur' }
  ],
  destination: [
    { required: true, message: '请输入目的地', trigger: 'blur' },
    { min: 1, max: 120, message: '目的地长度为 1-120 个字符', trigger: 'blur' }
  ],
  dateRange: [
    {
      required: true,
      validator: (_rule, value, callback) => {
        if (!value || value.length !== 2) return callback(new Error('请选择出行日期'))
        if (value[0] > value[1]) return callback(new Error('结束日期不能早于开始日期'))
        callback()
      },
      trigger: 'change'
    }
  ],
  totalBudget: [{ required: true, message: '请输入预算', trigger: 'blur' }]
}

function handleOpen() {
  if (props.trip) {
    form.title = props.trip.title
    form.destination = props.trip.destination
    form.dateRange = [props.trip.startDate, props.trip.endDate]
    form.totalBudget = Number(props.trip.totalBudget)
  } else {
    form.title = ''
    form.destination = ''
    form.dateRange = []
    form.totalBudget = 0
  }
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  const payload: TripPayload = {
    title: form.title,
    destination: form.destination,
    startDate: form.dateRange[0],
    endDate: form.dateRange[1],
    totalBudget: Number(form.totalBudget)
  }

  submitting.value = true
  try {
    const saved = props.trip?.tripId
      ? await tripApi.update(props.trip.tripId, payload)
      : await tripApi.create(payload)
    ElMessage.success(props.trip?.tripId ? '旅行已更新' : '旅行创建成功')
    emit('saved', saved)
    emit('update:modelValue', false)
  } catch {
    // 422/409 等错误由拦截器提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-tip {
  font-size: 12px;
  color: var(--tp-text-secondary);
  line-height: 1.6;
  margin-top: 4px;
}

.form-tip--inline {
  margin-top: 0;
  margin-left: 8px;
}
</style>
