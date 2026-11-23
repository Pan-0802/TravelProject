<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">AI 智能规划</h1>
        <p class="page-subtitle">
          和 AI 助手聊几句：告诉它想去哪、怎么走、预算多少，它会生成一份可编辑的行程表。
        </p>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" text @click="loadHistory">刷新历史</el-button>
        <el-button :icon="ChatDotRound" text @click="restart">重新开始</el-button>
      </div>
    </div>

    <div class="chat-layout">
      <!-- 对话区 -->
      <div class="tp-card chat-card">
        <div ref="scrollRef" class="chat-body">
          <div v-for="msg in messages" :key="msg.id" class="msg" :class="`msg--${msg.role}`">
            <div class="msg__avatar">
              <el-icon v-if="msg.role === 'ai'"><MagicStick /></el-icon>
              <span v-else>{{ userInitial }}</span>
            </div>
            <div class="msg__content">
              <div class="msg__bubble">
                <p class="msg__text">{{ msg.text }}</p>

                <div v-if="msg.kind === 'summary'" class="msg__summary">
                  <el-descriptions :column="2" size="small" border>
                    <el-descriptions-item label="目的地">{{ msg.summary?.destination }}</el-descriptions-item>
                    <el-descriptions-item label="天数">{{ msg.summary?.days }} 天</el-descriptions-item>
                    <el-descriptions-item label="日期">{{ msg.summary?.dates }}</el-descriptions-item>
                    <el-descriptions-item label="交通">{{ msg.summary?.transportation || '不限' }}</el-descriptions-item>
                    <el-descriptions-item label="预算">{{ money(msg.summary?.budget ?? 0) }}</el-descriptions-item>
                    <el-descriptions-item label="偏好">{{ msg.summary?.preferences || '无特别偏好' }}</el-descriptions-item>
                  </el-descriptions>
                </div>

                <div v-if="msg.rows && msg.rows.length" class="msg__table">
                  <el-table :data="msg.rows" size="small" border class="plan-table" max-height="320">
                    <el-table-column label="日期" width="108">
                      <template #default="{ row }">{{ shortDate(row.date) }}</template>
                    </el-table-column>
                    <el-table-column label="时间" width="104">
                      <template #default="{ row }">{{ row.time }}</template>
                    </el-table-column>
                    <el-table-column prop="itemName" label="安排" min-width="160" show-overflow-tooltip />
                    <el-table-column label="交通" width="86">
                      <template #default="{ row }">{{ row.transportation || '—' }}</template>
                    </el-table-column>
                    <el-table-column label="费用" width="92" align="right">
                      <template #default="{ row }">{{ money(row.estimatedCost) }}</template>
                    </el-table-column>
                  </el-table>
                  <div class="msg__table-foot">
                    共 {{ msg.rows.length }} 个安排，预估合计 {{ money(msg.estimatedTotal ?? 0) }}
                    <span class="tp-muted">（AI 预估，不计入实际消费）</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="generating" class="msg msg--ai">
            <div class="msg__avatar">
              <el-icon><MagicStick /></el-icon>
            </div>
            <div class="msg__content">
              <div class="msg__bubble msg__bubble--typing">
                <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                正在规划行程，通常需要 20–60 秒，请不要关闭页面…
              </div>
            </div>
          </div>
        </div>

        <!-- 输入区：随对话阶段切换 -->
        <div class="chat-input">
          <!-- 1. 选择旅行 -->
          <template v-if="step === 'trip'">
            <div class="chat-input__row">
              <el-select
                v-model="selectedTripId"
                placeholder="选择已有旅行"
                filterable
                clearable
                style="flex: 1 1 260px"
              >
                <el-option
                  v-for="trip in trips"
                  :key="trip.tripId"
                  :label="`${trip.title}（${trip.startDate} ~ ${trip.endDate}）`"
                  :value="trip.tripId"
                />
              </el-select>
              <el-button type="primary" :disabled="!selectedTripId" @click="chooseTrip">
                用这个旅行
              </el-button>
              <el-button @click="startFromScratch">从零开始规划</el-button>
            </div>
          </template>

          <!-- 2. 选择城市 -->
          <template v-else-if="step === 'city'">
            <div class="chat-input__row">
              <CityCascader
                v-model="cityDraft"
                placeholder="先选省，再选市"
                width="320px"
                @change="chooseCity"
              />
            </div>
            <div class="chat-chips">
              <el-check-tag
                v-for="city in HOT_CITY_OPTIONS"
                :key="city"
                :checked="false"
                @change="chooseCity(city)"
              >
                {{ city }}
              </el-check-tag>
            </div>
          </template>

          <!-- 3. 选择日期 -->
          <template v-else-if="step === 'dates'">
            <div class="chat-input__row">
              <el-date-picker
                v-model="dateDraft"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="出发日期"
                end-placeholder="返程日期"
                style="flex: 1 1 320px"
              />
              <el-button type="primary" :disabled="!dateDraft || dateDraft.length !== 2" @click="chooseDates">
                确定
              </el-button>
            </div>
            <p class="chat-hint">V1 限制 1–15 天；开始与结束日期都计入行程。</p>
          </template>

          <!-- 4. 交通方式 -->
          <template v-else-if="step === 'transport'">
            <div class="chat-chips">
              <el-check-tag
                v-for="item in TRANSPORTATION_OPTIONS"
                :key="item"
                :checked="false"
                @change="chooseTransport(item)"
              >
                {{ item }}
              </el-check-tag>
            </div>
          </template>

          <!-- 5. 预算 -->
          <template v-else-if="step === 'budget'">
            <div class="chat-input__row">
              <el-input-number
                v-model="form.totalBudget"
                :min="0"
                :max="9999999999.99"
                :precision="0"
                :step="100"
                controls-position="right"
                style="width: 180px"
              />
              <span class="chat-unit">元</span>
              <el-button type="primary" @click="chooseBudget">确定</el-button>
            </div>
            <div class="chat-chips">
              <el-check-tag v-for="amount in BUDGET_PRESETS" :key="amount" :checked="false" @change="pickBudget(amount)">
                {{ amount }} 元
              </el-check-tag>
            </div>
          </template>

          <!-- 6. 偏好 -->
          <template v-else-if="step === 'preferences'">
            <div class="chat-input__row">
              <el-select
                v-model="form.preferences"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="选择偏好（可多选，最多 10 项）"
                style="flex: 1 1 320px"
              >
                <el-option v-for="p in PREFERENCE_OPTIONS" :key="p" :label="p" :value="p" />
              </el-select>
              <el-button type="primary" @click="choosePreferences">确定</el-button>
            </div>
          </template>

          <!-- 7. 附加要求 -->
          <template v-else-if="step === 'requirements'">
            <div class="chat-input__row chat-input__row--top">
              <el-input
                v-model="form.requirements"
                type="textarea"
                :rows="2"
                maxlength="500"
                show-word-limit
                placeholder="还有什么要求？例如：行程不要太赶、想多安排点美食（可跳过）"
                style="flex: 1 1 320px"
              />
              <div class="chat-input__buttons">
                <el-button @click="chooseRequirements('')">跳过</el-button>
                <el-button type="primary" @click="chooseRequirements(form.requirements)">确定</el-button>
              </div>
            </div>
          </template>

          <!-- 8. 确认生成 -->
          <template v-else-if="step === 'confirm'">
            <div class="chat-input__row">
              <el-button type="primary" :icon="MagicStick" :loading="generating" @click="generate">
                开始生成方案
              </el-button>
              <el-button @click="restart">重新填写</el-button>
            </div>
          </template>

          <!-- 9. 完成 -->
          <template v-else-if="step === 'done'">
            <div class="chat-input__row">
              <el-button type="primary" @click="goEdit">编辑并保存行程</el-button>
              <el-button @click="restart">再规划一个</el-button>
            </div>
          </template>
        </div>
      </div>

      <!-- 历史 -->
      <div class="tp-card tp-card__body history-card">
        <h2 class="section-title">我的规划历史</h2>
        <el-table v-loading="historyLoading" :data="history" size="small" empty-text="还没有 AI 规划记录">
          <el-table-column label="目的地" min-width="110">
            <template #default="{ row }">
              <div class="history-dest">{{ row.destination }}</div>
              <div class="tp-muted">{{ dateTime(row.createdAt) }}</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="86">
            <template #default="{ row }">
              <el-tag :type="aiStatusTagType(row.status)" size="small" effect="light">
                {{ aiStatusLabel(row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="70" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openPlan(row)">查看</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination">
          <el-pagination
            v-model:current-page="historyQuery.page"
            :page-size="historyQuery.size"
            :total="historyTotal"
            layout="prev, pager, next"
            small
            background
            @current-change="loadHistory"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatDotRound, MagicStick, Refresh } from '@element-plus/icons-vue'
import { aiApi } from '@/api/ai'
import { tripApi } from '@/api/trip'
import CityCascader from '@/components/common/CityCascader.vue'
import { useAuthStore } from '@/stores/auth'
import {
  AI_STATUS_LABELS,
  AI_STATUS_TAG_TYPE,
  HOT_CITY_OPTIONS,
  PREFERENCE_OPTIONS,
  PROVINCE_CITIES,
  TRANSPORTATION_OPTIONS
} from '@/constants'
import type { AiPlan, AiPlanListItem, AiPlanStatus, Trip } from '@/types/api'
import { dateTime, daysBetween, money, shortDate } from '@/utils/format'
import { errorCode } from '@/utils/request'

type Step = 'trip' | 'city' | 'dates' | 'transport' | 'budget' | 'preferences' | 'requirements' | 'confirm' | 'done'

interface PlanRow {
  date: string
  time: string
  itemName: string
  transportation: string | null
  estimatedCost: number
}

interface ChatMsg {
  id: number
  role: 'ai' | 'user'
  text: string
  kind?: 'text' | 'summary'
  rows?: PlanRow[]
  estimatedTotal?: number | null
  summary?: {
    destination: string
    days: number
    dates: string
    transportation: string
    budget: number
    preferences: string
  }
}

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const BUDGET_PRESETS = [1000, 2000, 3000, 5000]

const messages = ref<ChatMsg[]>([])
const step = ref<Step>('trip')
const generating = ref(false)
const scrollRef = ref<HTMLElement | null>(null)
const selectedTripId = ref('')
const cityDraft = ref('')
const dateDraft = ref<string[] | null>(null)
const trips = ref<Trip[]>([])
const plan = ref<AiPlan | null>(null)

const form = reactive({
  destination: '',
  startDate: '',
  endDate: '',
  totalBudget: 2000,
  transportation: '',
  preferences: [] as string[],
  requirements: ''
})

const history = ref<AiPlanListItem[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyQuery = reactive({ page: 1, size: 8 })

let seq = 0

const userInitial = computed(() => auth.avatarText)

const travelDays = computed(() => daysBetween(form.startDate, form.endDate))

function aiStatusLabel(status: AiPlanStatus) {
  return AI_STATUS_LABELS[status] || status
}

function aiStatusTagType(status: AiPlanStatus) {
  return AI_STATUS_TAG_TYPE[status] || 'info'
}

function scrollToBottom() {
  const scroll = () => {
    const el = scrollRef.value
    if (el) el.scrollTop = el.scrollHeight
  }
  nextTick(scroll)
  // 表格渲染后高度还会变化，补一次滚动
  window.setTimeout(scroll, 180)
}

function pushAi(text: string, extra: Partial<ChatMsg> = {}) {
  messages.value.push({ id: ++seq, role: 'ai', text, ...extra })
  scrollToBottom()
}

function pushUser(text: string) {
  messages.value.push({ id: ++seq, role: 'user', text })
  scrollToBottom()
}

/* ---------- 对话流程 ---------- */

function startFromScratch() {
  selectedTripId.value = ''
  pushUser('从零开始，帮我规划一次新的旅行')
  pushAi('好的，你想去哪个城市？')
  step.value = 'city'
  scrollToBottom()
}

function chooseTrip() {
  const trip = trips.value.find((item) => item.tripId === selectedTripId.value)
  if (!trip) {
    ElMessage.warning('请先选择一个旅行')
    return
  }
  form.destination = trip.destination
  form.startDate = trip.startDate
  form.endDate = trip.endDate
  form.totalBudget = Math.round(Number(trip.totalBudget)) || form.totalBudget
  pushUser(`基于「${trip.title}」来规划`)
  pushAi(
    `好的！${trip.destination}，${trip.startDate} 到 ${trip.endDate}，共 ${daysBetween(trip.startDate, trip.endDate)} 天。` +
      '这次打算用什么交通方式？'
  )
  step.value = 'transport'
  scrollToBottom()
}

function chooseCity(city: string) {
  if (!city) return
  form.destination = city
  cityDraft.value = city
  const shortName = shortCityName(city)
  pushUser(`我想去${shortName}`)
  pushAi(`${shortName}不错！计划哪几天出发？选一下日期区间。`)
  step.value = 'dates'
  scrollToBottom()
}

/** 「浙江省杭州市」→「杭州市」，对话里读起来更自然 */
function shortCityName(value: string): string {
  const province = Object.keys(PROVINCE_CITIES).find(
    (item) => value !== item && value.startsWith(item)
  )
  return province ? value.slice(province.length) : value
}

function chooseDates() {
  if (!dateDraft.value || dateDraft.value.length !== 2) return
  form.startDate = dateDraft.value[0]
  form.endDate = dateDraft.value[1]
  const days = daysBetween(form.startDate, form.endDate)
  if (days < 1 || days > 15) {
    ElMessage.warning('旅行天数需在 1-15 天之间')
    return
  }
  pushUser(`${form.startDate} 到 ${form.endDate}，共 ${days} 天`)
  pushAi('收到。当地出行主要靠什么？步行多、公共交通，还是打车/自驾？')
  step.value = 'transport'
  scrollToBottom()
}

function chooseTransport(value: string) {
  form.transportation = value
  pushUser(`交通：${value}`)
  pushAi(`好的，${value}出行。这趟旅行大概准备花多少钱？`)
  step.value = 'budget'
  scrollToBottom()
}

function pickBudget(amount: number) {
  form.totalBudget = amount
  chooseBudget()
}

function chooseBudget() {
  const budget = Number(form.totalBudget) || 0
  pushUser(`预算大约 ${budget} 元`)
  pushAi('明白。你对行程有什么偏好？可以多选，也可以自己输入。')
  step.value = 'preferences'
  scrollToBottom()
}

function choosePreferences() {
  if (form.preferences.length > 10) {
    ElMessage.warning('偏好最多选择 10 项')
    return
  }
  pushUser(form.preferences.length ? `偏好：${form.preferences.join('、')}` : '没有特别偏好')
  pushAi('还有别的要求吗？比如不想太赶、想多留点自由时间。没有的话可以跳过。')
  step.value = 'requirements'
  scrollToBottom()
}

function chooseRequirements(text: string) {
  form.requirements = text
  pushUser(text || '没有额外要求')
  showSummary()
}

function showSummary() {
  const summary = {
    destination: form.destination,
    days: travelDays.value,
    dates: `${form.startDate} 至 ${form.endDate}`,
    transportation: form.transportation,
    budget: form.totalBudget,
    preferences: form.preferences.join('、')
  }
  pushAi(
    '信息齐了，我先复述一遍，确认无误就点「开始生成方案」：',
    { kind: 'summary', summary }
  )
  step.value = 'confirm'
  scrollToBottom()
}

async function generate() {
  if (generating.value) return
  if (travelDays.value < 1 || travelDays.value > 15) {
    ElMessage.warning('旅行天数需在 1-15 天之间')
    return
  }

  generating.value = true
  try {
    const result = await aiApi.generate({
      tripId: selectedTripId.value || null,
      destination: form.destination,
      startDate: form.startDate,
      endDate: form.endDate,
      travelDays: travelDays.value,
      totalBudget: Number(form.totalBudget) || 0,
      transportation: form.transportation || null,
      preferences: form.preferences,
      requirements: form.requirements || null
    })
    plan.value = result
    showPlan(result)
    loadHistory()
  } catch (error) {
    const code = errorCode(error)
    const message = (error as Error)?.message || '生成失败'
    if (code === 50300) {
      pushAi('后端还没有配置大模型 API Key，暂时无法生成。可以联系后端同学配置后再试。')
    } else if (code === 50400) {
      pushAi('AI 响应超时了，稍后再点一次「开始生成方案」试试。')
    } else if (code === 50200) {
      pushAi('AI 返回的内容无法解析，请重新生成一次。')
    } else {
      pushAi(`生成失败：${message}`)
    }
    step.value = 'confirm'
  } finally {
    generating.value = false
    scrollToBottom()
  }
}

function showPlan(result: AiPlan) {
  const rows: PlanRow[] = []
  for (const day of result.days.slice().sort((a, b) => a.dayNumber - b.dayNumber)) {
    const items = day.items.slice().sort((a, b) => a.sortOrder - b.sortOrder)
    for (const item of items) {
      rows.push({
        date: day.date,
        time: `${item.startTime || '—'}${item.endTime ? ' - ' + item.endTime : ''}`,
        itemName: item.itemName,
        transportation: item.transportation,
        estimatedCost: Number(item.estimatedCost) || 0
      })
    }
  }

  pushAi(
    `方案好了！${result.destination} ${result.travelDays} 天，共 ${rows.length} 个安排。` +
      '下面是提炼后的行程表，点「编辑并保存行程」可以逐项修改并写入旅行。',
    {
      rows,
      estimatedTotal: result.estimatedTotal
    }
  )
  step.value = 'done'
  scrollToBottom()
}

function goEdit() {
  if (!plan.value) return
  router.push(`/ai/result/${plan.value.aiPlanId}`)
}

function restart() {
  messages.value = []
  step.value = 'trip'
  plan.value = null
  selectedTripId.value = ''
  cityDraft.value = ''
  dateDraft.value = null
  form.destination = ''
  form.startDate = ''
  form.endDate = ''
  form.totalBudget = 2000
  form.transportation = ''
  form.preferences = []
  form.requirements = ''
  greet()
}

/* ---------- 数据加载 ---------- */

function greet() {
  pushAi(
    '你好，我是你的旅行规划助手 👋 我可以帮你安排行程。先确认一下：这次是基于已有的旅行计划，还是从零开始？'
  )
}

async function loadTrips() {
  try {
    // 旅行可能超过 50 条，按页取全，保证下拉里都能选到
    const all: Trip[] = []
    let page = 1
    while (page <= 20) {
      const result = await tripApi.list({ page, size: 50 })
      all.push(...result.list)
      if (result.list.length < 50 || all.length >= result.total) break
      page += 1
    }
    trips.value = all

    // 从「用 AI 规划行程」跳转过来时带 tripId，直接替用户选好
    const queryTripId = route.query.tripId as string | undefined
    if (queryTripId) {
      const target = all.find((item) => item.tripId === queryTripId)
      if (target) {
        selectedTripId.value = target.tripId
        chooseTrip()
      }
    }
  } catch {
    trips.value = []
  }
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

onMounted(() => {
  greet()
  loadTrips()
  loadHistory()
})
</script>

<style scoped>
.chat-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 16px;
  align-items: start;
}

.chat-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-body {
  height: 560px;
  overflow-y: auto;
  padding: 20px 20px 8px;
  background: linear-gradient(180deg, #fbfcff 0%, #ffffff 100%);
}

.msg {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}

.msg--user {
  flex-direction: row-reverse;
}

.msg__avatar {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tp-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
}

.msg--user .msg__avatar {
  background: #7c5cf0;
}

.msg__content {
  max-width: min(760px, 86%);
  min-width: 0;
}

.msg__bubble {
  background: #fff;
  border: 1px solid var(--tp-border);
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 2px 10px rgba(31, 45, 61, 0.05);
}

.msg--user .msg__bubble {
  background: #eef4ff;
  border-color: #d7e4ff;
}

.msg__text {
  margin: 0;
  line-height: 1.75;
  font-size: 14px;
  white-space: pre-wrap;
}

.msg__summary {
  margin-top: 10px;
}

.msg__table {
  margin-top: 12px;
}

.plan-table {
  width: 100%;
}

.msg__table-foot {
  margin-top: 8px;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.msg__bubble--typing {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--tp-text-secondary);
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--tp-primary);
  animation: blink 1.2s infinite ease-in-out;
}

.dot:nth-child(2) {
  animation-delay: 0.2s;
}

.dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 80%, 100% {
    opacity: 0.25;
  }
  40% {
    opacity: 1;
  }
}

.chat-input {
  border-top: 1px solid var(--tp-border);
  padding: 14px 18px 16px;
  background: #fff;
}

.chat-input__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.chat-input__row--top {
  align-items: flex-start;
}

.chat-input__buttons {
  display: flex;
  gap: 8px;
}

.chat-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 10px;
}

.chat-chips :deep(.el-check-tag) {
  font-weight: 400;
}

.chat-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.chat-unit {
  font-size: 13px;
  color: var(--tp-text-secondary);
  margin-right: 4px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.history-card {
  position: sticky;
  top: 80px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
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
  .chat-layout {
    grid-template-columns: 1fr;
  }
  .history-card {
    position: static;
  }
  .chat-body {
    height: 460px;
  }
}
</style>
