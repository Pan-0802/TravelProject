<template>
  <div class="page planner-page">
    <div class="page-header"><div><h1 class="page-title">AI 智能规划</h1><p class="page-subtitle">把想法变成清晰的每日安排，再保存到你的旅行。</p></div><el-button v-if="selectedTripId" @click="router.push('/trips/'+selectedTripId)">返回关联旅行</el-button></div>
    <div class="planner-steps"><span class="current">1 填写旅行想法</span><span>→</span><span>2 多轮聊天 · 调整安排</span><span>→</span><span>3 确认保存到旅行</span></div>
    <div class="planner-grid">
      <div class="tp-card tp-card__body">
        <h2>这次想怎么旅行？</h2>
        <el-form label-position="top" @submit.prevent="generate">
          <el-form-item label="基于已有旅行（自动带入目的地、日期与预算）">
            <el-select v-model="selectedTripId" clearable filterable placeholder="选择已有旅行，或直接填写新旅行" style="width:100%" :disabled="generating" @change="useTrip">
              <el-option v-for="trip in trips" :key="trip.tripId" :label="trip.title+'（'+trip.destination+' · '+trip.startDate+' ~ '+trip.endDate+'）'" :value="trip.tripId"/>
            </el-select>
          </el-form-item>
          <el-form-item label="用自己的话描述这次旅行">
            <el-input v-model="form.requirements" type="textarea" :rows="4" maxlength="500" show-word-limit :disabled="generating" placeholder="例如：带爸妈去重庆，不想走太多台阶，想看洪崖洞夜景，每天最多三个景点，午后留点休息时间。"/>
            <div class="idea-chips"><el-button v-for="idea in ideas" :key="idea" size="small" :disabled="generating" @click="addIdea(idea)">{{ idea }}</el-button></div>
            <p class="conversation-tip">进入会话后可以连续提问、解释安排和调整方案，消息会保存。</p>
          </el-form-item>
          <div class="form-grid">
            <el-form-item label="目的地" required><CitySelect v-model="form.destination" :disabled="Boolean(selectedTripId)||generating" placeholder="例如：重庆"/></el-form-item>
            <el-form-item label="出行日期（1–15 天）" required><el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" style="width:100%" :disabled="Boolean(selectedTripId)||generating"/></el-form-item>
            <el-form-item label="本次总预算（元）"><el-input-number v-model="form.totalBudget" :min="0" :max="9999999999.99" :precision="2" :step="100" :disabled="generating" style="width:100%"/></el-form-item>
            <el-form-item label="当地主要交通"><el-select v-model="form.transportation" style="width:100%" :disabled="generating"><el-option v-for="t in TRANSPORTATION_OPTIONS" :key="t" :label="t" :value="t"/></el-select></el-form-item>
          </div>
          <el-form-item label="旅行偏好（可选）"><el-select v-model="form.preferences" multiple filterable allow-create :multiple-limit="10" style="width:100%" :disabled="generating" placeholder="选几个你喜欢的主题"><el-option v-for="p in PREFERENCE_OPTIONS" :key="p" :label="p" :value="p"/></el-select></el-form-item>
          <div class="generate-footer"><div><strong>{{ form.destination || '选择目的地' }} · {{ travelDays > 0 ? travelDays : '—' }} 天</strong><p>条件可以随时修改；生成后仍可编辑，不会立即覆盖已有行程。</p></div><el-button type="primary" size="large" :loading="generating" @click="generate">生成旅行方案</el-button></div>
        </el-form>
        <div v-if="generating" class="generation-state" role="status"><strong>正在创建旅行对话…</strong><p>接下来可以边聊边查看方案。</p></div>
        <el-alert v-if="failure" :title="failure" type="error" :closable="false" show-icon style="margin-top:16px"/>
      </div>
      <aside>
        <div class="tp-card tp-card__body history-card" style="margin-bottom:16px"><div class="history-head"><h3>继续上次的聊天</h3><el-button text @click="loadConversations">刷新</el-button></div><RequestError :message="conversationFailure" @retry="loadConversations"/><p v-if="!conversationFailure && !conversations.length" class="tp-muted">还没有会话，从左侧填写条件开始。</p><div v-for="chat in conversations" :key="chat.conversationId" class="conversation-history-row"><button class="history-entry" @click="router.push('/ai/chat/'+chat.conversationId)"><span><strong>{{ chat.title }}</strong><small>{{ dateTime(chat.updatedAt) }}</small></span><el-tag v-if="chat.processing" size="small">回复中</el-tag></button></div><ListPagination :page="conversationPage" :total="conversationTotal" @change="page=>{conversationPage=page;loadConversations()}"/></div>
        <div class="tp-card tp-card__body planning-summary"><h3>你的旅行简报</h3><p>{{ form.destination || '还没决定目的地' }}</p><p>{{ dateRange?.length===2 ? dateRange.join(' 至 ') : '先选出行日期' }}</p><p>{{ money(form.totalBudget) }} · {{ form.transportation }}</p><p v-if="form.preferences.length">{{ form.preferences.join(' / ') }}</p><div class="summary-note">AI 会尽量把相邻景点安排在一起，并预留用餐和休息时间。生成后按天查看，点击活动即可修改。</div></div>
        <div class="tp-card tp-card__body history-card"><div class="history-head"><h3>最近的规划</h3><el-button text @click="loadHistory">刷新</el-button></div>
          <RequestError :message="historyFailure" :loading="historyLoading" @retry="loadHistory"/><div v-if="!historyFailure && !history.length && !historyLoading" class="tp-muted">还没有规划，试试描述你的第一趟旅行。</div>
          <button v-for="item in history" :key="item.aiPlanId" class="history-entry" @click="router.push('/ai/result/'+item.aiPlanId)"><span><strong>{{ item.destination }}</strong><small>{{ dateTime(item.createdAt) }}</small></span><el-tag size="small" :type="AI_STATUS_TAG_TYPE[item.status]">{{ AI_STATUS_LABELS[item.status] }}</el-tag></button>
          <ListPagination :page="historyPage" :total="historyTotal" @change="page=>{historyPage=page;loadHistory()}"/>
        </div>
      </aside>
    </div>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import ListPagination from '@/components/common/ListPagination.vue'
import RequestError from '@/components/common/RequestError.vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import CitySelect from '@/components/common/CitySelect.vue'
import { aiApi } from '@/api/ai'
import { tripApi } from '@/api/trip'
import {conversationApi,type ConversationSummary} from '@/api/conversation'
import { AI_STATUS_LABELS, AI_STATUS_TAG_TYPE, PREFERENCE_OPTIONS, TRANSPORTATION_OPTIONS } from '@/constants'
import type { AiPlanListItem, Trip } from '@/types/api'
import { dateTime, daysBetween, money } from '@/utils/format'
const route=useRoute(),router=useRouter()
const selectedTripId=ref(''),trips=ref<Trip[]>([]),dateRange=ref<string[]>([])
const generating=ref(false),failure=ref('')
const form=reactive({destination:'',totalBudget:2000,transportation:'公共交通',preferences:[] as string[],requirements:''})
const ideas=['每天最多 3 个景点','少走路，多休息','美食和夜景优先','尽量顺路，不走回头路']
const history=ref<AiPlanListItem[]>([]),historyTotal=ref(0),historyPage=ref(1),historyLoading=ref(false),historyFailure=ref('')
const conversations=ref<ConversationSummary[]>([]),conversationPage=ref(1),conversationTotal=ref(0),conversationFailure=ref('')
async function loadConversations(){try{const r=await conversationApi.list(conversationPage.value);conversations.value=r.list;conversationTotal.value=r.total;conversationFailure.value=''}catch(e){conversationFailure.value=(e as Error).message}}
async function deleteConversation(chat:ConversationSummary){try{await ElMessageBox.confirm('删除这段聊天和消息记录？已生成的方案与正式旅行会保留。','删除会话')}catch{return}try{await conversationApi.remove(chat.conversationId);await loadConversations()}catch(e){ElMessage.error((e as Error).message)}}
const travelDays=computed(()=>daysBetween(dateRange.value?.[0],dateRange.value?.[1]))
function addIdea(text:string) { form.requirements=(form.requirements?form.requirements+'；':'')+text;form.requirements=form.requirements.slice(0,500) }
function useTrip(id:string) {
  const trip=trips.value.find(t=>t.tripId===id)
  if(!trip) return
  form.destination=trip.destination;dateRange.value=[trip.startDate,trip.endDate];form.totalBudget=Number(trip.totalBudget)
}
async function loadTrips() {
  try { trips.value=await tripApi.options();selectedTripId.value=String(route.query.tripId||'');useTrip(selectedTripId.value) }
  catch { trips.value=[] }
}
async function loadHistory() {
  historyLoading.value=true;historyFailure.value=''
  try { const r=await aiApi.list({page:historyPage.value,size:20});history.value=r.list;historyTotal.value=r.total }
  catch(e) { historyFailure.value=(e as Error).message } finally { historyLoading.value=false }
}
async function generate() {
  if(generating.value) return
  if(!form.destination.trim()) {ElMessage.warning('请选择目的地');return}
  if(dateRange.value?.length!==2 || travelDays.value<1 || travelDays.value>15) {ElMessage.warning('请选择 1–15 天的出行日期');return}
  if(!Number.isFinite(form.totalBudget)||form.totalBudget<0) {ElMessage.warning('请填写有效预算');return}
  generating.value=true;failure.value=''
  try {
    const result=await conversationApi.create({conditions:{tripId:selectedTripId.value||null,destination:form.destination,startDate:dateRange.value[0]!,endDate:dateRange.value[1]!,travelDays:travelDays.value,totalBudget:form.totalBudget,transportation:form.transportation,preferences:form.preferences,requirements:form.requirements||null}})
    generating.value=false
    await router.push({path:'/ai/chat/'+result.conversationId,query:{start:'1'}})
  } catch(e) {
    failure.value=(e as Error).message+'。填写的条件已保留；如发生超时，请先刷新规划历史确认结果，再决定是否重试。'
    await loadHistory()
  } finally { generating.value=false }
}
onBeforeRouteLeave(()=>{if(generating.value){ElMessage.info('方案仍在生成，请稍候再离开');return false}})
watch(()=>route.query.tripId,()=>{selectedTripId.value=String(route.query.tripId||'');useTrip(selectedTripId.value)})
onMounted(()=>{loadTrips();loadHistory();loadConversations()})
</script>
<style scoped>
.conversation-tip{font-size: var(--tp-font-body);color:var(--tp-primary);line-height:1.6;margin:8px 0 0}.conversation-history-row{display:flex;gap:4px;align-items:center}.conversation-history-row .history-entry{flex:1;min-width:0}
.planner-steps{display:flex;gap:16px;align-items:center;flex-wrap:wrap;color:var(--tp-primary);margin-bottom:16px;font-size: var(--tp-font-body)}.planner-steps .current{color:var(--tp-primary);font-weight:600}.planner-grid{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}.planner-grid h2{margin:0 0 24px;font-size: var(--tp-font-title)}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 16px}.idea-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.idea-chips .el-button{margin-left:0}.generate-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid #e5eaf3;padding-top:16px}.generate-footer p,.generation-state p{font-size: var(--tp-font-body);color:var(--tp-primary);line-height:1.7;margin:4px 0}.planning-summary{background:linear-gradient(145deg,#eff4ff,#fff);margin-bottom:16px}.planning-summary h3,.history-head h3{margin:0 0 12px;font-size: var(--tp-font-section)}.planning-summary p{color:var(--tp-primary);font-size: var(--tp-font-body)}.summary-note{border-top:1px solid #dce5f5;padding-top:12px;font-size: var(--tp-font-body);color:var(--tp-primary);line-height:1.8}.history-head{display:flex;align-items:baseline;justify-content:space-between}.history-entry{display:flex;width:100%;align-items:center;justify-content:space-between;gap:8px;background:transparent;border:0;border-bottom:1px solid #edf1f7;text-align:left;padding:12px 0;cursor:pointer;color:inherit}.history-entry:hover{color:var(--tp-primary)}.history-entry small{display:block;color:var(--tp-text-secondary);margin-top:8px}.generation-state{background:#eff5ff;border-radius:10px;margin-top:16px;padding:16px}@media(max-width:1100px){.planner-grid{grid-template-columns:1fr}.planner-grid aside{display:grid;grid-template-columns:1fr 1fr;gap:16px}}@media(max-width:700px){.form-grid,.planner-grid aside{grid-template-columns:1fr}.planner-steps{gap:8px;font-size: var(--tp-font-body)}}
</style>
