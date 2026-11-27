<template>
  <div class="page" v-loading="loading" element-loading-text="加载方案中…">
    <RequestError :message="loadFailure" :loading="loading" @retry="loadPlan"/>
    <div class="page-header">
      <div>
        <el-button link :icon="ArrowLeft" class="back-btn" @click="router.push('/ai')">
          返回 AI 规划
        </el-button>
        <h1 class="page-title">{{ plan ? `${plan.destination} · AI 旅行方案` : 'AI 旅行方案' }}</h1>
        <p class="page-subtitle" v-if="plan">
          <el-tag :type="statusTagType" size="small" effect="light">{{ statusLabel }}</el-tag>
          <span class="sep">·</span>
          {{ plan.startDate }} ~ {{ plan.endDate }}
          <span class="sep">·</span>
          {{ plan.travelDays }} 天
          <span class="sep">·</span>
          当前方案预估 <span class="tp-money">{{ money(editedTotal) }}</span>
        </p>
      </div>

      <div class="header-actions" v-if="plan">
        <el-button :disabled="saving" :loading="openingChat" @click="openConversation">在会话中继续讨论</el-button>
        <el-button :icon="Refresh" :disabled="saving" @click="loadPlan">重新加载</el-button>
        <el-button
          v-if="isDraft"
          type="primary"
          :loading="saving"
          :disabled="!days.length"
          @click="handleSave"
        >
          确认保存到旅行
        </el-button>
        <el-button v-else-if="plan.status === 'SAVED' && plan.tripId" type="primary" @click="goTrip">
          查看该旅行
        </el-button>
      </div>
    </div>

    <el-alert
      v-if="plan"
      class="ai-disclaimer"
      type="warning"
      :closable="false"
      show-icon
      title="AI 生成内容仅供参考"
      description="门票、交通与开放时间请以实际为准；预估费用不会计入实际消费，实际记账请到旅行详情的“消费记录”中填写。"
    />

    <el-alert
      v-if="plan?.status === 'SAVED'"
      class="ai-disclaimer"
      type="success"
      :closable="false"
      show-icon
      title="该方案已保存为正式行程"
      description="历史草稿保留的是 AI 原始建议，正式行程请到旅行详情查看与修改。"
    />

    <el-result
      v-if="plan?.status === 'FAILED'"
      icon="error"
      title="本次 AI 生成失败"
      :sub-title="plan.errorMessage || '大模型返回内容异常或服务不可用，请返回重新生成。'"
    >
      <template #extra>
        <el-button type="primary" @click="router.push('/ai')">重新生成</el-button>
      </template>
    </el-result>

    <template v-else-if="plan">
      <!-- 保存目标 -->
      <div class="tp-card tp-card__body save-bar">
        <div class="save-bar__field">
          <span class="save-bar__label">保存到旅行</span>
          <el-select
            v-model="selectedTripId"
            placeholder="请选择要保存到的旅行"
            style="width: 320px"
            :disabled="!isDraft || Boolean(plan.tripId) || saving"
          >
            <el-option
              v-for="trip in trips"
              :key="trip.tripId"
              :label="`${trip.title}（${trip.startDate} ~ ${trip.endDate}）`"
              :value="trip.tripId"
            />
          </el-select>
          <el-button v-if="isDraft && !plan.tripId" text type="primary" @click="createTripVisible = true">
            按此方案创建旅行
          </el-button>
        </div>
        <div class="save-bar__hint">
          <el-alert
            v-if="tripMismatch"
            type="error"
            :closable="false"
            show-icon
            title="所选旅行的目的地或起止日期与方案不一致，请选择匹配的旅行或重新生成方案。"
          />
          <el-alert
            v-else-if="isDraft"
            type="info"
            :closable="false"
            show-icon
            title="保存会用本方案替换目标旅行在方案日期范围内的全部行程项，不会删除消费、收藏或旅行本身。"
          />
        </div>
      </div>

      <div v-if="isDraft" class="tp-card tp-card__body refine-bar">
        <strong>想换一种安排？</strong><p class="tp-muted">直接说哪里不合适，AI 会参考当前编辑后的行程生成另一版；原草稿保留。</p>
        <div class="refine-row"><el-input v-model="refinement" maxlength="200" placeholder="例如：第二天太赶，减少一个景点，多留时间吃饭" :disabled="refining"/><el-button :loading="refining" :disabled="!plan.request || !refinement.trim() || saving" @click="refine">按新要求生成另一版</el-button></div>
      </div>
      <nav class="day-navigation" aria-label="跳转到某天"><el-button v-for="day in days" :key="day.date" size="small" @click="jumpToDay(day.date)">第 {{ day.dayNumber }} 天 · {{ day.date.slice(5) }}</el-button></nav>
      <!-- 每日行程编辑 -->
      <div v-for="(day, dayIndex) in days" :id="'plan-day-'+day.date" :key="day.date" class="tp-card day-editor">
        <div class="day-editor__head">
          <span class="day-badge">第 {{ day.dayNumber }} 天</span>
          <span class="day-date">{{ day.date }} {{ weekday(day.date) }}</span>
          <el-input
            v-model="day.description"
            size="small"
            maxlength="255"
            placeholder="当天主题（可选），如：市区观光"
            class="day-desc"
            :disabled="!isDraft"
          />
          <div class="tp-toolbar__spacer"></div>
          <el-button v-if="isDraft&&needsTimeOrder(day.items)" size="small" text type="primary" @click="arrangeDay(dayIndex)">按时间整理</el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :icon="Plus"
            :disabled="!isDraft"
            @click="addItem(dayIndex)"
          >
            添加活动
          </el-button>
        </div>

        <div v-if="day.items.length === 0" class="day-editor__empty">
          这一天还没有活动安排，可以留空，也可以点击“添加活动”。
        </div>

        <div v-for="(item, itemIndex) in day.items" :key="itemIndex" class="item-editor">
          <div class="item-editor__top">
            <span class="activity-index">{{ itemIndex + 1 }}</span>
            <el-time-picker
              v-model="item.startTime"
              @change="autoSchedule(dayIndex,itemIndex)"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="开始"
              size="small"
              style="width: 118px"
              :disabled="!isDraft"
            />
            <span class="dash">-</span>
            <el-time-picker
              v-model="item.endTime"
              format="HH:mm"
              value-format="HH:mm"
              placeholder="结束"
              size="small"
              style="width: 118px"
              :disabled="!isDraft"
            />
            <el-input
              v-model.trim="item.itemName"
              size="small"
              maxlength="150"
              placeholder="活动名称（必填）"
              class="item-name"
              :disabled="!isDraft"
            />
            <el-button text type="danger" size="small" :disabled="!isDraft" @click="removeItem(dayIndex, itemIndex)">
              删除
            </el-button>
            <el-button text size="small" :disabled="!isDraft || itemIndex===0" @click="moveItem(dayIndex,itemIndex,-1)">上移</el-button>
            <el-button text size="small" :disabled="!isDraft || itemIndex===day.items.length-1" @click="moveItem(dayIndex,itemIndex,1)">下移</el-button>
          </div>

          <div class="item-meta"><span>预计 {{ money(item.estimatedCost) }} · {{ item.transportation || '交通待定' }}</span><el-button text size="small" @click="expanded=expanded===day.date+itemIndex?'':day.date+itemIndex">{{ expanded===day.date+itemIndex?'收起详情':'费用、景点与备注' }}</el-button></div>
          <div v-show="expanded===day.date+itemIndex" class="item-editor__bottom">
            <el-select
              v-model="item.transportation"
              size="small"
              placeholder="交通方式"
              clearable
              filterable
              allow-create
              default-first-option
              style="width: 140px"
              :disabled="!isDraft"
            >
              <el-option v-for="t in TRANSPORTATION_OPTIONS" :key="t" :label="t" :value="t" />
            </el-select>

            <el-input-number
              v-model="item.estimatedCost"
              size="small"
              :min="0"
              :max="99999999.99"
              :precision="2"
              :step="10"
              controls-position="right"
              style="width: 140px"
              :disabled="!isDraft"
            />

            <el-select
              v-model="item.attractionId"
              @change="(id: string) => linkAttraction(item, id)"
              size="small"
              placeholder="关联本地景点（可选）"
              clearable
              filterable
              style="width: 220px"
              :disabled="!isDraft"
            >
              <el-option
                v-for="attraction in attractions"
                :key="attraction.attractionId"
                :label="attraction.name"
                :value="attraction.attractionId"
              />
            </el-select>

            <el-input
              v-model="item.note"
              size="small"
              maxlength="500"
              placeholder="备注（可选）"
              class="item-note"
              :disabled="!isDraft"
            />
          </div>
        </div>
      </div>

      <div class="bottom-actions" v-if="isDraft">
        <el-button @click="router.push('/ai')">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">确认保存到旅行</el-button>
      </div>
    </template>
    <TripFormDialog v-if="plan" v-model="createTripVisible" :prefill="{title:plan.destination+'旅行',destination:plan.destination,startDate:plan.startDate,endDate:plan.endDate,totalBudget:plan.request?.totalBudget ?? editedTotal}" @saved="tripCreated" />
  </div>
</template>

<script setup lang="ts">
import RequestError from "@/components/common/RequestError.vue"
import {errorMessage} from "@/utils/request"
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import {byStartTime,insertByTime,needsTimeOrder} from '@/utils/schedule'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Plus, Refresh } from '@element-plus/icons-vue'
import { aiApi } from '@/api/ai'
import { attractionApi } from '@/api/attraction'
import { tripApi } from '@/api/trip'
import { AI_STATUS_LABELS, AI_STATUS_TAG_TYPE, TRANSPORTATION_OPTIONS } from '@/constants'
import type { AiPlan, AiPlanDay, AiPlanItem, Attraction, Trip } from '@/types/api'
import { money, weekday } from '@/utils/format'
import { errorCode } from '@/utils/request'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'
import {conversationApi} from '@/api/conversation'

const route = useRoute()
const router = useRouter()

const plan = ref<AiPlan | null>(null)
const days = ref<AiPlanDay[]>([])
const trips = ref<Trip[]>([])
const attractions = ref<Attraction[]>([])
const selectedTripId = ref('')
const loading = ref(false)
const loadFailure=ref('')
const saving = ref(false)
const openingChat=ref(false)
async function openConversation(){if(!plan.value)return;openingChat.value=true;try{const chat=await conversationApi.create({aiPlanId:plan.value.aiPlanId,...(dirty.value?{currentDays:buildDays()}:{})});allowLeave=true;await router.push('/ai/chat/'+chat.conversationId)}catch(e){ElMessage.error((e as Error).message)}finally{openingChat.value=false;allowLeave=false}}
const expanded = ref('')
const createTripVisible = ref(false), refinement = ref(''), refining = ref(false)
let allowLeave = false
const editedTotal = computed(() => days.value.reduce((n,d)=>n+d.items.reduce((s,i)=>s+Number(i.estimatedCost||0),0),0))
const dirty = computed(() => isDraft.value && JSON.stringify(days.value)!==JSON.stringify(normalizeDays(plan.value?.days||[])))
function arrangeDay(index:number){const day=days.value[index];if(day){day.items=byStartTime(day.items);day.items.forEach((item,i)=>{item.sortOrder=i+1})}}
function autoSchedule(dayIndex:number,itemIndex:number){const day=days.value[dayIndex],item=day?.items[itemIndex];if(day&&item){day.items=insertByTime(day.items,item,itemIndex);day.items.forEach((entry,i)=>{entry.sortOrder=i+1})}}
function moveItem(d:number,i:number,offset:number) { const items=days.value[d]?.items; if(!items) return; const removed=items.splice(i,1)[0]; if(removed) items.splice(i+offset,0,removed) }
function linkAttraction(item:AiPlanItem,id:string) { const a=attractions.value.find(a=>a.attractionId===id); if(a) item.itemName=a.name }
function jumpToDay(date:string) {document.getElementById('plan-day-'+date)?.scrollIntoView({behavior:'smooth',block:'start'})}
async function tripCreated(trip:Trip) { await loadTrips();selectedTripId.value=trip.tripId }
async function refine() {
  if(!plan.value?.request || refining.value || !refinement.value.trim()) return
  if(days.value.some(d=>d.items.some(i=>!i.itemName.trim()))){ElMessage.warning('先补全空白活动名称，再让 AI 调整');return}
  if(dirty.value) { try { await ElMessageBox.confirm('将参考当前编辑后的安排，按新要求生成另一版；不会立即覆盖正式行程。继续吗？','生成另一版') } catch { return } }
  refining.value=true
  try {
    const original=plan.value.request
    const referenceDays=buildDays().map(d=>({...d,items:d.items.map(({attractionId,...item})=>item)}))
    const result=await conversationApi.create({conditions:{...original,referenceDays,requirements:((original.requirements||'').slice(0,280)+'；调整要求：'+refinement.value.trim()).slice(0,500)}})
    allowLeave=true;await router.push({path:'/ai/chat/'+result.conversationId,query:{start:'1'}});refinement.value=''
  } catch(e) { ElMessage.error((e as Error).message+'，当前方案和修改已保留') }
  finally { refining.value=false;allowLeave=false }
}

const aiPlanId = computed(() => String(route.params.aiPlanId || ''))
const isDraft = computed(() => plan.value?.status === 'DRAFT')
const statusLabel = computed(() => (plan.value ? AI_STATUS_LABELS[plan.value.status] : ''))
const statusTagType = computed(() => (plan.value ? AI_STATUS_TAG_TYPE[plan.value.status] : 'info'))

const selectedTrip = computed(() =>
  trips.value.find((trip) => trip.tripId === selectedTripId.value)
)

const tripMismatch = computed(() => {
  if (!plan.value || !selectedTrip.value) return false
  return (
    selectedTrip.value.destination !== plan.value.destination ||
    selectedTrip.value.startDate !== plan.value.startDate ||
    selectedTrip.value.endDate !== plan.value.endDate
  )
})

function normalizeDays(source: AiPlanDay[]): AiPlanDay[] {
  return [...(source || [])]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => ({
      date: day.date,
      dayNumber: day.dayNumber,
      description: day.description ?? null,
      items: [...(day.items || [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          itemName: item.itemName,
          startTime: item.startTime ?? null,
          endTime: item.endTime ?? null,
          sortOrder: item.sortOrder,
          transportation: item.transportation ?? null,
          estimatedCost: Number(item.estimatedCost ?? 0),
          note: item.note ?? null,
          attractionId: item.attractionId ?? null
        }))
    }))
}

async function loadPlan() {
  loading.value = true
  loadFailure.value=''
  try {
    const detail = await aiApi.detail(aiPlanId.value)
    plan.value = detail
    days.value = normalizeDays(detail.days)
    selectedTripId.value = detail.tripId || ''
    if(detail.status==='DRAFT') {
      try { const saved=JSON.parse(sessionStorage.getItem('ai-edit:'+detail.aiPlanId)||'null');
        if(saved && saved.original===JSON.stringify(detail.days)) {days.value=saved.days;selectedTripId.value=saved.tripId||detail.tripId||'';ElMessage.info('已恢复本窗口尚未保存的方案修改')}
      } catch { /* Ignore damaged local draft; the server result is still valid. */ }
    } else sessionStorage.removeItem('ai-edit:'+detail.aiPlanId)
  } catch(error) {
    loadFailure.value=errorMessage(error)
    plan.value = null
    days.value = []
  } finally {
    loading.value = false
  }
}

async function loadTrips() {
  try {
    const result = await tripApi.options()
    trips.value = result
    if (!selectedTripId.value && plan.value) {
      const matched = result.find(
        (trip) => trip.destination === plan.value?.destination && trip.startDate === plan.value?.startDate && trip.endDate === plan.value?.endDate
      )
      if (matched) selectedTripId.value = matched.tripId
    }
  } catch {
    trips.value = []
  }
}

async function loadAttractions() {
  try {
    attractions.value = await attractionApi.options()
  } catch {
    attractions.value = []
  }
}

function addItem(dayIndex: number) {
  const day = days.value[dayIndex]
  if (!day) return
  if (day.items.length >= 50) { ElMessage.warning('每天最多50个活动'); return }
  const item: AiPlanItem = {
    itemName: '',
    startTime: null,
    endTime: null,
    sortOrder: day.items.length + 1,
    transportation: null,
    estimatedCost: 0,
    note: null,
    attractionId: null
  }
  day.items.push(item)
}

function removeItem(dayIndex: number, itemIndex: number) {
  days.value[dayIndex]?.items.splice(itemIndex, 1)
}

function validate(): string | null {
  if (!plan.value) return '方案未加载'
  if (!selectedTripId.value) return '请先选择要保存到的旅行'
  if (!selectedTrip.value) return '目标旅行不存在或尚未加载，请刷新后重试'
  if (plan.value.tripId && selectedTripId.value !== plan.value.tripId) return '该草稿只能保存到原关联旅行'
  if (tripMismatch.value) return '所选旅行目的地或日期与方案不一致，请更换旅行或重新生成方案'

  if (days.value.length !== plan.value.travelDays) {
    return `方案应包含 ${plan.value.travelDays} 天，当前为 ${days.value.length} 天，请重新加载后再保存`
  }

  for (const day of days.value) {
    if (day.items.length > 50) return `${day.date} 最多50个活动`
    for (const item of day.items) {
      if (!item.itemName || !item.itemName.trim()) {
        return `${day.date} 存在未填写名称的活动，请补全或删除`
      }
      if (item.startTime && item.endTime && item.endTime < item.startTime) {
        return `${day.date} 的「${item.itemName}」结束时间早于开始时间`
      }
      if (!Number.isFinite(Number(item.estimatedCost)) || Number(item.estimatedCost) < 0 || Number(item.estimatedCost) > 99999999.99) {
        return `${day.date} 的「${item.itemName}」预估费用需在0至99999999.99之间`
      }
      if ((item.transportation?.length || 0) > 60) return '交通方式最多60字'
    }
  }
  return null
}

function buildDays(): AiPlanDay[] {
  return days.value.map((day) => ({
    date: day.date,
    dayNumber: day.dayNumber,
    description: day.description || null,
    items: day.items.map((item, index) => ({
      itemName: item.itemName.trim(),
      startTime: item.startTime || null,
      endTime: item.endTime || null,
      sortOrder: index + 1,
      transportation: item.transportation || null,
      estimatedCost: Number(item.estimatedCost) || 0,
      note: item.note || null,
      attractionId: item.attractionId || null
    }))
  }))
}

async function submitSave(confirmOverwrite: boolean) {
  if (!plan.value) return
  const result = await aiApi.save(plan.value.aiPlanId, {
    tripId: selectedTripId.value,
    confirmOverwrite,
    days: buildDays()
  })
  ElMessage.success(`已保存 ${result.savedDays} 天、${result.savedItems} 个行程项`)
  plan.value.status='SAVED'
  sessionStorage.removeItem('ai-edit:'+plan.value.aiPlanId)
  await router.push(`/trips/${result.tripId}`)
}

async function handleSave() {
  if (saving.value || refining.value || !plan.value) return

  const error = validate()
  if (error) {
    ElMessage.warning(error)
    return
  }

  saving.value = true
  try {
    await submitSave(false)
  } catch (err) {
    const code = errorCode(err)
    if (code === 40900) {
      // A 409 can also mean another tab/user action already saved this draft.
      // Inspect state without overwriting local edits when the draft is still editable.
      try {
        const latest = await aiApi.detail(aiPlanId.value)
        if (latest.status !== 'DRAFT') {
          plan.value = latest
          days.value = normalizeDays(latest.days)
          selectedTripId.value = latest.tripId || ''
          ElMessage.info(latest.status === 'SAVED' ? '该方案已经保存，请查看正式行程' : '该方案无法保存，请重新生成')
          return
        }
      } catch {
        ElMessage.error('无法确认方案状态，请刷新后重试')
        return
      }
      // 目标旅行已有行程：二次确认后覆盖保存
      try {
        await ElMessageBox.confirm(
          '目标旅行在该日期范围内已有行程。继续保存会替换这些行程项（消费、收藏与旅行本身不受影响）。是否覆盖？',
          '覆盖已有行程',
          { type: 'warning', confirmButtonText: '覆盖保存', cancelButtonText: '取消' }
        )
      } catch {
        return
      }
      try {
        await submitSave(true)
      } catch (retryError) {
        if (errorCode(retryError) === 40900) await loadPlan()
        ElMessage.error((retryError as Error).message || '保存失败')
      }
    } else {
      ElMessage.error((err as Error).message || '保存失败')
    }
  } finally {
    saving.value = false
  }
}

function goTrip() {
  if (plan.value?.tripId) router.push(`/trips/${plan.value.tripId}`)
}

watch(aiPlanId, () => {
  loadPlan().then(loadTrips)
})

onMounted(async () => {
  await loadPlan()
  await Promise.all([loadTrips(), loadAttractions()])
})
watch([days,selectedTripId],()=>{if(plan.value?.status==='DRAFT') {try {sessionStorage.setItem('ai-edit:'+plan.value.aiPlanId,JSON.stringify({original:JSON.stringify(plan.value.days),days:days.value,tripId:selectedTripId.value}))}catch{/* Storage can be unavailable. */}}},{deep:true})
onBeforeRouteLeave(async()=>{
  if(refining.value && !allowLeave){ElMessage.info('正在生成另一版，请稍候');return false}
  if(dirty.value && !allowLeave) {try{await ElMessageBox.confirm('方案修改还未保存到旅行。修改已保留在当前窗口，确定离开吗？','离开方案编辑',{confirmButtonText:'离开',cancelButtonText:'继续编辑'})}catch{return false}}
})
</script>

<style scoped>
.day-navigation{display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;margin-bottom:8px;position:sticky;top:60px;z-index:5;background:#f4f6fc}.day-navigation .el-button{margin-left:0}
.item-meta{display:flex;justify-content:space-between;align-items:center;font-size: var(--tp-font-body);color:var(--tp-primary);padding-top:4px}
.refine-bar{margin-bottom:16px}.refine-row{display:flex;gap:12px;flex-wrap:wrap}.refine-row .el-input{flex:1;min-width:230px}.activity-index{color:var(--tp-primary);background:#edf3ff;border-radius:6px;padding:4px 8px}.day-editor{scroll-margin-top:24px}
.back-btn {
  margin-bottom:4px;
  padding-left:0;
}

.header-actions {
  display: flex;
  gap:8px;
  flex-wrap: wrap;
}

.sep {
  color:#c3ccda;
  margin:0 4px;
}

.page-subtitle {
  display: flex;
  align-items: center;
  gap:4px;
  flex-wrap: wrap;
}

.ai-disclaimer {
  margin-bottom:12px;
}

.save-bar {
  margin-bottom:16px;
}

.save-bar__field {
  display: flex;
  align-items: center;
  gap:12px;
  flex-wrap: wrap;
  margin-bottom:8px;
}

.save-bar__label {
  font-weight: 600;
  font-size: var(--tp-font-body);
}

.day-editor {
  padding:12px 16px;
  margin-bottom:12px;
  border: 1px solid var(--tp-border);
  background: #fff;
}

.day-editor__head {
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
  padding-bottom:8px;
  border-bottom: 1px dashed var(--tp-border);
}

.day-badge {
  background: var(--tp-primary);
  color:#ffffff;
  border-radius: 6px;
  padding:4px 8px;
  font-size: var(--tp-font-body);
  font-weight: 600;
}

.day-date {
  font-weight: 600;
  font-size: var(--tp-font-body);
}

.day-desc {
  max-width: 320px;
}

.day-editor__empty {
  padding:12px 4px;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}

.item-editor {
  padding:8px 0;
  border-bottom: 1px dashed var(--tp-border);
}

.item-editor:last-child {
  border-bottom: none;
}

.item-editor__top {
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
}

.item-editor__bottom {
  display: flex;
  align-items: center;
  gap:8px;
  flex-wrap: wrap;
  margin-top:8px;
}

.dash {
  color:var(--tp-text-secondary);
}

.item-name {
  flex: 1 1 220px;
  min-width: 200px;
}

.item-note {
  flex: 1 1 200px;
  min-width: 180px;
}

.bottom-actions {
  display: flex;
  justify-content: flex-end;
  gap:8px;
  padding:4px 0 24px;
}
</style>
