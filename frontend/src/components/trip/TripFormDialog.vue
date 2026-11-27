<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑旅行' : '新建旅行'"
    width="min(560px, 94vw)"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="88px">
      <el-form-item label="旅行名称" prop="title" :error="fieldErrors.title">
        <el-input v-model.trim="form.title" maxlength="120" show-word-limit placeholder="例如：重庆三日游" />
      </el-form-item>

      <el-form-item label="目的地" prop="destination" :error="fieldErrors.destination">
        <CitySelect v-model="form.destination" placeholder="请选择目的地城市" />
      </el-form-item>

      <el-form-item label="出行日期" prop="dateRange" :error="fieldErrors.dateRange">
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

      <el-form-item label="预算" prop="totalBudget" :error="fieldErrors.totalBudget">
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
        title="修改日期前，请先调整范围之外的每日行程和消费记录，或保留能包含这些记录的出行日期。"
      />
      <el-alert v-if="submitError" :title="submitError" type="error" :closable="false" show-icon role="alert" />
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { useFormErrors } from "@/utils/formErrors"
import { computed, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { tripApi } from '@/api/trip'
import CitySelect from '@/components/common/CitySelect.vue'
import type { Trip, TripPayload } from '@/types/api'
import { daysBetween } from '@/utils/format'

const props = defineProps<{
  modelValue: boolean
  trip?: Trip | null
  prefill?: Partial<TripPayload>
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', trip: Trip): void
}>()

const isEdit = computed(() => Boolean(props.trip?.tripId))
const formRef = ref<FormInstance>()
const submitting = ref(false)
const { fieldErrors, submitError, clearErrors, showError } = useFormErrors({ startDate: 'dateRange', endDate: 'dateRange' })

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
  clearErrors()
  if (props.trip) {
    form.title = props.trip.title
    form.destination = props.trip.destination
    form.dateRange = [props.trip.startDate, props.trip.endDate]
    form.totalBudget = Number(props.trip.totalBudget)
  } else {
    form.title = props.prefill?.title || ''
    form.destination = props.prefill?.destination || ''
    form.dateRange = props.prefill?.startDate && props.prefill.endDate ? [props.prefill.startDate, props.prefill.endDate] : []
    form.totalBudget = Number(props.prefill?.totalBudget ?? 0)
  }
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (submitting.value) return
  clearErrors()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return

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
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.form-tip {
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
  line-height: 1.6;
  margin-top:4px;
}

.form-tip--inline {
  margin-top:0;
  margin-left:8px;
}
</style>
