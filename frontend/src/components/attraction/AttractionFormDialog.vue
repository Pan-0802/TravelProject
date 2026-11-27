<template>
  <el-dialog
    :model-value="modelValue"
    :title="isEdit ? '编辑自建景点' : '新增自建景点'"
    width="min(600px, 94vw)"
    :close-on-click-modal="false"
    destroy-on-close
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
    @open="handleOpen"
  >
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="dialog-alert"
      :title="prefill ? '已带入搜索结果的名称、城市和分类，请核对后保存。时长、门票和描述可自行补充。' : '填写景点资料，保存后可收藏，并在每日行程中关联。'"
    />

    <el-form ref="formRef" :model="form" :rules="rules" label-width="96px">
      <el-form-item label="景点名称" prop="name" :error="fieldErrors.name">
        <el-input v-model.trim="form.name" maxlength="120" show-word-limit placeholder="例如：李子坝观景平台" />
      </el-form-item>

      <el-form-item label="所在城市" prop="city" :error="fieldErrors.city">
        <CityCascader v-model="form.city" placeholder="先选省，再选市" />
      </el-form-item>

      <el-form-item label="分类" prop="category" :error="fieldErrors.category">
        <el-input v-model.trim="form.category" maxlength="40" placeholder="例如：观景 / 美食 / 博物馆" />
      </el-form-item>

      <el-form-item label="建议游玩">
        <el-input-number
          v-model="form.suggestedDurationMinutes"
          :min="0"
          :max="65535"
          :step="30"
          controls-position="right"
          style="width: 180px"
        />
        <span class="unit">分钟（0 表示未填写）</span>
      </el-form-item>

      <el-form-item label="参考门票">
        <el-input-number
          v-model="form.referenceTicketPrice"
          :min="0"
          :max="999999.99"
          :precision="2"
          :step="10"
          controls-position="right"
          style="width: 180px"
          placeholder="未知可留空"
        />
        <span class="unit">元</span>
      </el-form-item>

      <el-form-item label="描述">
        <el-input
          v-model.trim="form.description"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="记录你自己的游玩经验、注意事项等"
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
import CityCascader from '@/components/common/CityCascader.vue'
import type { Attraction, AttractionPayload } from '@/types/api'

const props = defineProps<{
  modelValue: boolean
  attraction?: Attraction | null
  prefill?: Partial<AttractionPayload> | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'saved', attraction: Attraction): void
}>()

const isEdit = computed(() => Boolean(props.attraction?.attractionId))
const formRef = ref<FormInstance>()
const submitting = ref(false)
const { fieldErrors, submitError, clearErrors, showError } = useFormErrors({})

const form = reactive({
  name: '',
  city: '',
  category: '',
  description: '',
  suggestedDurationMinutes: 0,
  referenceTicketPrice: undefined as number | undefined
})

const rules: FormRules = {
  name: [
    { required: true, message: '请输入景点名称', trigger: 'blur' },
    { min: 1, max: 120, message: '名称长度为 1-120 个字符', trigger: 'blur' }
  ],
  city: [
    { required: true, message: '请输入所在城市', trigger: 'blur' },
    { min: 1, max: 80, message: '城市长度为 1-80 个字符', trigger: 'blur' }
  ],
  category: [{ max: 40, message: '分类最多 40 个字符', trigger: 'blur' }]
}

function handleOpen() {
  clearErrors()
  const item = props.attraction || props.prefill
  form.name = item?.name || ''
  form.city = item?.city || ''
  form.category = item?.category || ''
  form.description = item?.description || ''
  form.suggestedDurationMinutes = item?.suggestedDurationMinutes ?? 0
  form.referenceTicketPrice = item?.referenceTicketPrice == null ? undefined : Number(item.referenceTicketPrice)
  formRef.value?.clearValidate()
}

async function handleSubmit() {
  if (submitting.value) return
  clearErrors()
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || submitting.value) return

  const duration = Number(form.suggestedDurationMinutes)
  if (duration < 0 || duration > 65535 || !Number.isInteger(duration)) {
    ElMessage.warning('建议游玩时长需为 0-65535 之间的整数')
    return
  }

  const payload: AttractionPayload = {
    name: form.name,
    city: form.city,
    category: form.category || null,
    description: form.description || null,
    suggestedDurationMinutes: duration > 0 ? duration : null,
    referenceTicketPrice: form.referenceTicketPrice == null ? null : Number(form.referenceTicketPrice)
  }

  submitting.value = true
  try {
    const saved = props.attraction?.attractionId
      ? await attractionApi.update(props.attraction.attractionId, payload)
      : await attractionApi.create(payload)
    ElMessage.success(props.attraction?.attractionId ? '景点已更新'
      : props.prefill ? `「${saved.name}」已录入，可在每日行程的“关联景点”中选择` : '景点已创建')
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
.dialog-alert {
  margin-bottom:16px;
}

.unit {
  margin-left:8px;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
}
</style>
