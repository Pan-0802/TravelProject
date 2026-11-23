<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑行程项' : `添加行程（${date}）`"
    width="620px"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="活动名称" prop="itemName">
        <el-input v-model.trim="form.itemName" maxlength="150" show-word-limit placeholder="例如：解放碑步行游览" />
      </el-form-item>

      <el-form-item label="时间段">
        <div class="time-row">
          <el-time-picker
            v-model="form.startTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="开始时间"
            style="width: 150px"
          />
          <span class="time-sep">至</span>
          <el-time-picker
            v-model="form.endTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="结束时间"
            style="width: 150px"
          />
          <span class="tp-muted">可留空</span>
        </div>
      </el-form-item>

      <el-form-item label="关联景点">
        <el-select
          v-model="form.attractionId"
          placeholder="可选，仅本地自建景点"
          clearable
          filterable
          style="width: 100%"
          :loading="attractionLoading"
        >
          <el-option
            v-for="item in attractions"
            :key="item.attractionId"
            :label="`${item.name}${item.city ? ' · ' + item.city : ''}`"
            :value="item.attractionId"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="交通方式">
        <el-select
          v-model="form.transportation"
          placeholder="可选"
          clearable
          filterable
          allow-create
          default-first-option
          style="width: 220px"
        >
          <el-option v-for="t in TRANSPORTATION_OPTIONS" :key="t" :label="t" :value="t" />
        </el-select>
      </el-form-item>

      <el-form-item label="预计费用">
        <el-input-number
          v-model="form.estimatedCost"
          :min="0"
          :max="99999999.99"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 200px"
        />
        <span class="unit">元</span>
      </el-form-item>

      <el-form-item label="备注">
        <el-input
          v-model.trim="form.note"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="可选，例如：提前确认开放时间"
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
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { attractionApi } from '@/api/attraction'
import { itineraryApi } from '@/api/itinerary'
import { TRANSPORTATION_OPTIONS } from '@/constants'
import type { Attraction, ItineraryItem } from '@/types/api'

const props = defineProps<{
  modelValue: boolean
  tripId: string
  date: string
  item?: ItineraryItem | null
  nextSortOrder?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const isEdit = computed(() => Boolean(props.item?.itemId))
const formRef = ref<FormInstance>()
const submitting = ref(false)
const attractions = ref<Attraction[]>([])
const attractionLoading = ref(false)

const form = reactive({
  itemName: '',
  startTime: '' as string | null,
  endTime: '' as string | null,
  attractionId: null as string | null,
  transportation: '' as string | null,
  estimatedCost: 0,
  note: ''
})

const rules: FormRules = {
  itemName: [
    { required: true, message: '请输入活动名称', trigger: 'blur' },
    { min: 1, max: 150, message: '活动名称长度为 1-150 个字符', trigger: 'blur' }
  ]
}

async function loadAttractions() {
  attractionLoading.value = true
  try {
    attractions.value = await attractionApi.options()
  } catch {
    attractions.value = []
  } finally {
    attractionLoading.value = false
  }
}

function handleOpen() {
  const item = props.item
  form.itemName = item?.itemName || ''
  form.startTime = item?.startTime || ''
  form.endTime = item?.endTime || ''
  form.attractionId = item?.attractionId || null
  form.transportation = item?.transportation || ''
  form.estimatedCost = Number(item?.estimatedCost ?? 0)
  form.note = item?.note || ''
  formRef.value?.clearValidate()
  loadAttractions()
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (form.startTime && form.endTime && form.endTime < form.startTime) {
    ElMessage.warning('结束时间不能早于开始时间')
    return
  }
  if (form.note && form.note.length > 500) {
    ElMessage.warning('备注最多 500 字')
    return
  }

  const payload = {
    itemName: form.itemName,
    startTime: form.startTime || null,
    endTime: form.endTime || null,
    attractionId: form.attractionId || null,
    transportation: form.transportation || null,
    estimatedCost: Number(form.estimatedCost) || 0,
    note: form.note || null
  }

  submitting.value = true
  try {
    if (props.item?.itemId) {
      await itineraryApi.updateItem(props.item.itemId, payload)
      ElMessage.success('行程项已更新')
    } else {
      await itineraryApi.createItem(props.tripId, props.date, {
        ...payload,
        sortOrder: props.nextSortOrder ?? 1
      })
      ElMessage.success('行程项已添加')
    }
    emit('saved')
    emit('update:modelValue', false)
  } catch {
    // 422（日期越界等）由拦截器提示
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.time-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.time-sep {
  color: var(--tp-text-secondary);
}

.unit {
  margin-left: 8px;
  color: var(--tp-text-secondary);
  font-size: 13px;
}
</style>
