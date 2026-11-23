<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">AI 智能规划</h1>
        <p class="page-subtitle">
          填写目的地、天数、预算与偏好，由后端调用大模型生成结构化行程；生成后可逐项编辑再保存到旅行。
        </p>
      </div>
      <el-button :icon="Refresh" text @click="loadHistory">刷新历史</el-button>
    </div>

    <div class="ai-layout">
      <!-- 生成表单 -->
      <div class="tp-card tp-card__body ai-form-card">
        <h2 class="section-title">生成参数</h2>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
          <el-form-item label="关联旅行（可选）">
            <el-select
              v-model="form.tripId"
              placeholder="不关联则先规划，稍后保存时再选择"
              clearable
              style="width: 100%"
              @change="handleTripChange"
            >
              <el-option
                v-for="trip in trips"
                :key="trip.tripId"
                :label="`${trip.title}（${trip.startDate} ~ ${trip.endDate}）`"
                :value="trip.tripId"
              />
            </el-select>
            <div class="form-tip">关联旅行后，目的地与日期必须与该旅行一致。</div>
          </el-form-item>

          <el-form-item label="目的地" prop="destination">
            <el-input
              v-model.trim="form.destination"
              placeholder="例如：重庆"
              :disabled="Boolean(form.tripId)"
              maxlength="120"
            />
          </el-form-item>

          <el-form-item label="出行日期" prop="dateRange">
            <el-date-picker
              v-model="form.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              :disabled="Boolean(form.tripId)"
              style="width: 100%"
            />
            <div class="form-tip">
              共 {{ travelDays }} 天（V1 限制 1-15 天，以减少大模型调用成本）
            </div>
          </el-form-item>

          <el-form-item label="总预算">
            <el-input-number
              v-model="form.totalBudget"
              :min="0"
              :max="9999999999.99"
              :precision="2"
              :step="100"
              controls-position="right"
              style="width: 200px"
            />
            <span class="unit">元</span>
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

          <el-form-item label="旅行偏好">
            <el-select
              v-model="form.preferences"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="最多 10 项，可自定义"
              style="width: 100%"
            >
              <el-option v-for="p in PREFERENCE_OPTIONS" :key="p" :label="p" :value="p" />
            </el-select>
          </el-form-item>

          <el-form-item label="附加要求">
            <el-input
              v-model.trim="form.requirements"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
              placeholder="例如：行程不要太赶，安排一些休息时间"
            />
          </el-form-item>
        </el-form>

        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="ai-alert"
          title="生成过程为同步请求，通常需要数十秒，请勿重复点击；费用为 AI 预估，不会自动写入实际消费。"
        />

        <el-button
          type="primary"
          class="ai-submit"
          :icon="MagicStick"
          :loading="generating"
          @click="handleGenerate"
        >
          {{ generating ? 'AI 正在生成，请稍候…' : '生成旅行方案' }}
        </el-button>
      </div>

      <!-- 历史记录 -->
      <div class="tp-card tp-card__body ai-history-card">
        <h2 class="section-title">我的规划历史</h2>

        <el-table v-loading="historyLoading" :data="history" size="small" empty-text="还没有 AI 规划记录">
          <el-table-column label="目的地" min-width="120">
            <template #default="{ row }">
              <div class="history-dest">{{ row.destination }}</div>
              <div class="tp-muted">{{ dateTime(row.createdAt) }}</div>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag :type="aiStatusTagType(row.status)" size="small" effect="light">
                {{ aiStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="预估费用" width="100">
            <template #default="{ row }">
              <span class="tp-money">{{ money(row.estimatedTotal) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="90" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPlan(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination">
          <el-pagination
            v-model:current-page="historyQuery.page"
            v-model:page-size="historyQuery.size"
            :total="historyTotal"
            layout="prev, pager, next"
            size="small"
            background
            @current-change="loadHistory"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { MagicStick, Refresh } from '@element-plus/icons-vue'
import { aiApi } from '@/api/ai'
import { tripApi } from '@/api/trip'
import {
  AI_STATUS_LABELS,
  AI_STATUS_TAG_TYPE,
  PREFERENCE_OPTIONS,
  TRANSPORTATION_OPTIONS
} from '@/constants'
import type { AiPlanListItem, AiPlanStatus, Trip } from '@/types/api'
import { dateTime, daysBetween, money } from '@/utils/format'
import { errorCode, errorMessage } from '@/utils/request'

const route = useRoute()
const router = useRouter()

const formRef = ref<FormInstance>()
const generating = ref(false)
const trips = ref<Trip[]>([])

const form = reactive({
  tripId: '' as string,
  destination: '',
  dateRange: [] as string[],
  totalBudget: 1500,
  transportation: '' as string,
  preferences: [] as string[],
  requirements: ''
})

const travelDays = computed(() => daysBetween(form.dateRange?.[0], form.dateRange?.[1]))

const rules: FormRules = {
  destination: [{ required: true, message: '请输入目的地', trigger: 'blur' }],
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
  ]
}

const history = ref<AiPlanListItem[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyQuery = reactive({ page: 1, size: 8 })

function aiStatusLabel(status: AiPlanStatus) {
  return AI_STATUS_LABELS[status] || status
}

function aiStatusTagType(status: AiPlanStatus) {
  return AI_STATUS_TAG_TYPE[status] || 'info'
}

async function loadTrips() {
  try {
    const result = await tripApi.options()
    trips.value = result
    const queryTripId = route.query.tripId as string | undefined
    if (queryTripId && result.some((trip) => trip.tripId === queryTripId)) {
      form.tripId = queryTripId
      handleTripChange(queryTripId)
    }
  } catch {
    trips.value = []
  }
}

function handleTripChange(tripId: string) {
  if (!tripId) return
  const trip = trips.value.find((item) => item.tripId === tripId)
  if (!trip) return
  form.destination = trip.destination
  form.dateRange = [trip.startDate, trip.endDate]
  form.totalBudget = Number(trip.totalBudget)
}

async function loadHistory() {
  historyLoading.value = true
  try {
    const result = await aiApi.list({ page: historyQuery.page, size: historyQuery.size })
    history.value = result.list
    historyTotal.value = result.total
  } catch {
    history.value = []
    historyTotal.value = 0
  } finally {
    historyLoading.value = false
  }
}

function openPlan(row: AiPlanListItem) {
  router.push(`/ai/result/${row.aiPlanId}`)
}

async function handleGenerate() {
  if (generating.value) return

  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (travelDays.value < 1 || travelDays.value > 15) {
    ElMessage.warning('旅行天数需在 1-15 天之间')
    return
  }
  if (form.preferences.length > 10) {
    ElMessage.warning('旅行偏好最多选择 10 项')
    return
  }
  if (form.transportation.length > 60 || form.preferences.some(value => !value.trim() || value.length > 60)) {
    ElMessage.warning('交通方式和每项偏好最多60字，偏好不能为空')
    return
  }

  generating.value = true
  try {
    const plan = await aiApi.generate({
      tripId: form.tripId || null,
      destination: form.destination,
      startDate: form.dateRange[0],
      endDate: form.dateRange[1],
      travelDays: travelDays.value,
      totalBudget: Number(form.totalBudget) || 0,
      transportation: form.transportation || null,
      preferences: form.preferences,
      requirements: form.requirements || null
    })
    ElMessage.success('方案已生成，请检查并编辑后保存')
    await router.push(`/ai/result/${plan.aiPlanId}`)
  } catch (error) {
    const code = errorCode(error)
    if (code === 50300) {
      ElMessage.warning('后端未配置大模型 API Key，暂不可用')
    } else if (code === 50400) {
      ElMessage.warning('AI 服务响应超时，请稍后重试')
    } else if (code === 50200) {
      ElMessage.warning('AI 返回内容无法解析，请重新生成')
    } else {
      ElMessage.error(errorMessage(error, '生成失败，请稍后重试'))
    }
    ElMessage.info('请先刷新生成历史确认结果，避免重复提交生成请求')
    await loadHistory()
  } finally {
    generating.value = false
  }
}

watch(
  () => form.dateRange,
  () => {
    // 切换日期后清空与旅行关联的锁定，避免参数与旅行不一致
    if (form.tripId) {
      const trip = trips.value.find((item) => item.tripId === form.tripId)
      if (trip && (trip.startDate !== form.dateRange?.[0] || trip.endDate !== form.dateRange?.[1])) {
        form.tripId = ''
      }
    }
  }
)

onMounted(() => {
  loadTrips()
  loadHistory()
})
</script>

<style scoped>
.ai-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.section-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
}

.form-tip {
  font-size: 12px;
  color: var(--tp-text-secondary);
  line-height: 1.6;
  margin-top: 4px;
}

.unit {
  margin-left: 8px;
  color: var(--tp-text-secondary);
  font-size: 13px;
}

.ai-alert {
  margin: 4px 0 16px;
}

.ai-submit {
  width: 100%;
}

.history-dest {
  font-weight: 600;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 1100px) {
  .ai-layout {
    grid-template-columns: 1fr;
  }
}
</style>
