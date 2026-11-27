<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑行程项' : `添加行程（${date}）`"
    width="min(620px, 94vw)"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px" class="itinerary-edit-form">
      <el-form-item label="活动名称" prop="itemName" :error="fieldErrors.itemName">
        <el-input v-model.trim="form.itemName" maxlength="150" show-word-limit placeholder="例如：解放碑步行游览" />
      </el-form-item>

      <el-form-item label="时间段" prop="endTime" :error="fieldErrors.endTime">
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
        <p class="placement-hint">{{ form.startTime ? '保存后按开始时间自动排入当天行程。' : '不填开始时间时放在当天末尾，补充时间后自动归位。' }}</p>
        <p v-if="overlapNames.length" class="overlap-hint" role="status">与 {{ overlapNames.join('、') }} 时间重叠，请确认安排；保存不会调整其他活动的时间。</p>
      </el-form-item>

      <el-form-item label="关联景点" prop="attractionId" :error="fieldErrors.attractionId">
        <el-select
          v-model="form.attractionId"
          placeholder="可选，仅本地自建景点"
          clearable
          filterable
          style="width: 100%"
          :loading="attractionLoading"
          @change="selectAttraction"
        >
          <el-option
            v-for="item in attractions"
            :key="item.attractionId"
            :label="`${item.name}${item.city ? ' · ' + item.city : ''}`"
            :value="item.attractionId"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="交通方式" prop="transportation" :error="fieldErrors.transportation">
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

      <el-form-item label="预计费用" prop="estimatedCost" :error="fieldErrors.estimatedCost">
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

      <el-form-item label="备注" prop="note" :error="fieldErrors.note">
        <el-input
          v-model.trim="form.note"
          type="textarea"
          :rows="2"
          maxlength="500"
          show-word-limit
          placeholder="可选，例如：提前确认开放时间"
        />
      </el-form-item>
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
import { attractionApi } from '@/api/attraction'
import { itineraryApi } from '@/api/itinerary'
import { TRANSPORTATION_OPTIONS } from '@/constants'
import type { Attraction, ItineraryItem } from '@/types/api'
import { timeConflicts } from '@/utils/schedule'

const props = defineProps<{
  modelValue: boolean
  tripId: string
  date: string
  item?: ItineraryItem | null
  nextSortOrder?: number
  city?: string
  seed?: Partial<ItineraryItem>
  dayItems?: ItineraryItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved'): void
}>()

const isEdit = computed(() => Boolean(props.item?.itemId))
const formRef = ref<FormInstance>()
const submitting = ref(false)
const { fieldErrors, submitError, clearErrors, showError } = useFormErrors({startTime:'endTime'})
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
const overlapNames = computed(() => timeConflicts(form, (props.dayItems || []).filter(item => item.itemId !== props.item?.itemId)))

const rules: FormRules = {
  itemName: [
    { required: true, message: '请输入活动名称', trigger: 'blur' },
    { min: 1, max: 150, message: '活动名称长度为 1-150 个字符', trigger: 'blur' }
  ],
  endTime:[{validator:(_rule,value,callback)=>{
    if(form.startTime&&value&&value<form.startTime)return callback(new Error('结束时间不能早于开始时间，请调整时间段'))
    callback()
  },trigger:'change'}],
  transportation:[{max:60,message:'交通方式最多60字，请缩短后重试',trigger:'change'}],
  estimatedCost:[{validator:(_rule,value,callback)=>{
    if(value===null||value===undefined||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>99999999.99)return callback(new Error('请填写0至99999999.99元之间的费用'))
    callback()
  },trigger:'change'}],
  note:[{max:500,message:'备注最多500字，请精简后重试',trigger:'blur'}]
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
  clearErrors()
  const item = props.item || props.seed
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

function selectAttraction(id:string) {
  const a=attractions.value.find(a=>a.attractionId===id)
  if(!a) return
  form.itemName=a.name
  form.estimatedCost=Number(a.referenceTicketPrice||0)
  if(form.startTime && a.suggestedDurationMinutes) {
    const [h,m]=form.startTime.split(':').map(Number),end=h!*60+m!+a.suggestedDurationMinutes
    if(end<1440) form.endTime=String(Math.floor(end/60)).padStart(2,'0')+':'+String(end%60).padStart(2,'0')
  }
}

async function handleSubmit() {
  if (submitting.value) return
  clearErrors()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return

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
  } catch (error) {
    showError(error)
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.time-row {
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
}

.time-sep {
  color: var(--tp-text-secondary);
}

.unit {
  margin-left:8px;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}
.placement-hint,.overlap-hint{flex-basis:100%;font-size: var(--tp-font-body);line-height:1.7;margin:4px 0 0;color:var(--tp-text-secondary)}.overlap-hint{color:var(--tp-text-secondary)}
.itinerary-edit-form :deep(.el-form-item.is-error .placement-hint),
.itinerary-edit-form :deep(.el-form-item.is-error .overlap-hint) { display:none; }
</style>
