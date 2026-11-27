<template>
  <div class="page conversation-page" v-loading="loading">
    <div class="page-header">
      <div><el-button link @click="router.push('/ai')">← 返回规划与会话列表</el-button><h1 class="page-title">{{ conversation?.title || '旅行规划对话' }}</h1>
        <p v-if="conversation" class="page-subtitle">{{ conversation.conditions.startDate }} 至 {{ conversation.conditions.endDate }} · 预算 {{ money(conversation.conditions.totalBudget) }} · {{ conversation.conditions.transportation || '交通待商量' }}</p>
      </div>
      <div class="header-actions"><el-button :loading="refreshing" @click="refresh">{{ busy ? '查询发送状态' : '刷新会话' }}</el-button><el-button @click="router.push('/ai')">新建会话</el-button><el-button type="danger" plain :disabled="busy" @click="deleteConversation">删除会话</el-button></div>
    </div>
    <el-alert v-if="failure" :title="failure" type="error" :closable="false" show-icon class="conversation-error"/>
    <div v-if="conversation" class="conversation-layout">
      <section class="tp-card chat-workspace" aria-label="旅行助手对话">
        <header class="chat-heading"><strong>一起把旅行聊明白</strong><span>消息会保存，可以随时回来继续</span></header>
        <div ref="log" class="chat-log" role="log" aria-live="polite">
          <div v-if="!conversation.messages.length && !optimistic" class="chat-welcome"><h2>先聊想法，也能直接规划</h2><p>你可以问“为什么这样安排”，也可以说“第二天少一个景点”。右侧只会在生成新方案时更新。</p></div>
          <article v-for="message in visibleMessages" :key="message.messageId" class="chat-message" :class="'chat-message--'+message.role">
            <div class="chat-speaker">{{ message.role==='user'?'你':'旅行助手' }}</div>
            <div class="chat-bubble">{{ message.content }}</div>
            <div v-if="message.status==='PENDING'" class="message-state">正在思考和核对行程…</div>
            <div v-if="message.status==='FAILED'" class="message-failed">{{ message.errorMessage || '这次没有完成回复' }}<el-button text size="small" :disabled="busy" @click="retry(message)">重试这条消息</el-button></div>
            <el-button v-if="message.planId" size="small" text @click="router.push('/ai/result/'+message.planId)">查看这一版方案</el-button>
          </article>
          <article v-if="optimistic && !conversation.messages.some(m=>m.requestId===optimistic!.requestId)" class="chat-message chat-message--user"><div class="chat-speaker">你</div><div class="chat-bubble">{{ optimistic.content }}</div><div class="message-state">{{ busy ? '正在发送…' : '发送状态尚未确认，可查询状态后手动重试' }}</div></article>
          <div v-if="busy" class="thinking" role="status">消息已受理，旅行助手正在回复<span v-if="elapsed"> · 已等待 {{ elapsed }} 秒</span>。结果会自动同步，也可点击“查询发送状态”。</div>
        </div>
        <details v-if="conversation.memory" class="chat-memory"><summary>已记住的旅行偏好</summary><p>{{ conversation.memory }}</p></details>
        <div class="chat-composer">
          <div class="composer-toolbar"><label for="chat-intent" class="intent-label">本轮方式</label><el-select id="chat-intent" v-model="intent" :disabled="busy" aria-label="本轮对话方式" style="width:155px"><el-option label="自动判断" value="AUTO"/><el-option label="只问问题" value="ASK"/><el-option label="调整方案" value="REVISE"/></el-select><span>解释问题不会覆盖方案</span></div>
          <el-input ref="composer" v-model="input" type="textarea" :rows="3" maxlength="2000" show-word-limit :disabled="busy" placeholder="例如：我带着老人，第二天能少走些路吗？或问：为什么先安排这个景点？" @keydown="composeKey"/>
          <div class="composer-footer"><small>Enter 发送 · Shift + Enter 换行</small><el-button type="primary" :loading="busy" :disabled="!input.trim() || saving" @click="send()">发送消息</el-button></div>
        </div>
      </section>
      <section class="tp-card plan-workspace" aria-label="当前旅行方案">
        <header class="plan-heading"><div><span class="panel-eyebrow">每日行程</span><h2>旅行方案</h2></div><el-tag v-if="plan" :type="plan.status==='SAVED'?'success':'info'" effect="plain" round>{{ plan.status==='SAVED'?'已保存':'草稿' }}</el-tag></header>
        <div v-if="!plan" class="plan-empty"><el-empty description="聊聊你的想法，生成后在这里查看每日安排" :image-size="100"/></div>
        <template v-else>
          <PlanTimeline v-model="days" :editable="editable" :budget="conversation.conditions.totalBudget" :can-discuss="!busy&&!saving" @discuss="discussDay"/>
          <footer class="plan-footer">
            <div class="save-context"><span class="save-dot" :class="{'save-dot--edited':dirty}"></span><span>{{ plan.status==='SAVED'?'已保存到旅行':dirty?'有未保存的修改':'方案已同步' }}</span><small v-if="plan.status==='DRAFT'&&targetTripId">· {{ targetTripTitle }}</small><el-button v-if="plan.status==='DRAFT'&&!plan.tripId" text size="small" @click="saveDialog=true">{{ targetTripId?'更换旅行':'选择保存到的旅行' }}</el-button></div>
            <div class="save-controls"><template v-if="plan.status==='DRAFT'"><el-button v-if="dirty" :disabled="busy||saving" :loading="syncing" @click="saveDraft">保存草稿编辑</el-button><el-button type="primary" :loading="saving" :disabled="busy||syncing" @click="requestSave">确认保存到旅行</el-button></template><el-button v-else-if="plan.tripId" type="primary" @click="router.push('/trips/'+plan!.tripId)">查看正式旅行</el-button></div>
          </footer>
        </template>
      </section>
    </div>
    <el-dialog v-model="saveDialog" title="保存到旅行" width="min(480px, 94vw)" :close-on-click-modal="false"><p class="save-dialog-hint">选择日期和目的地相同的旅行，或直接创建一趟。</p><el-select v-model="targetTripId" placeholder="选择保存到的旅行" filterable :disabled="Boolean(plan?.tripId)" style="width:100%"><el-option v-for="trip in compatibleTrips" :key="trip.tripId" :label="trip.title" :value="trip.tripId"/></el-select><el-button v-if="!plan?.tripId" text type="primary" style="margin-top:12px" @click="saveDialog=false;tripDialog=true">创建匹配旅行</el-button><template #footer><el-button @click="saveDialog=false">取消</el-button><el-button type="primary" :disabled="!targetTripId||busy" :loading="saving" @click="savePlan">确认保存到旅行</el-button></template></el-dialog>
    <TripFormDialog v-if="conversation" v-model="tripDialog" :prefill="{title:conversation.conditions.destination+'旅行',destination:conversation.conditions.destination,startDate:conversation.conditions.startDate,endDate:conversation.conditions.endDate,totalBudget:conversation.conditions.totalBudget}" @saved="tripCreated"/>
  </div>
</template>
<script setup lang="ts">
import {computed,nextTick,onBeforeUnmount,onMounted,ref,watch} from 'vue'
import {onBeforeRouteLeave,useRoute,useRouter} from 'vue-router'
import {ElMessage,ElMessageBox} from 'element-plus'
import {conversationApi,type Conversation,type ChatMessage,type SendMessage} from '@/api/conversation'
import {aiApi} from '@/api/ai'
import {tripApi} from '@/api/trip'
import type {AiPlanDay,Trip} from '@/types/api'
import {money} from '@/utils/format'
import {errorCode} from '@/utils/request'
import PlanTimeline from '@/components/ai/PlanTimeline.vue'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'

const route=useRoute(),router=useRouter()
const id=computed(()=>String(route.params.conversationId||''))
const conversation=ref<Conversation|null>(null),days=ref<AiPlanDay[]>([]),trips=ref<Trip[]>([])
const input=ref(''),intent=ref<'AUTO'|'ASK'|'REVISE'>('AUTO'),failure=ref('')
const loading=ref(false),sending=ref(false),saving=ref(false),syncing=ref(false),tripDialog=ref(false)
const refreshing=ref(false),startedAt=ref(0),now=ref(Date.now()),saveDialog=ref(false),composer=ref<{focus:()=>void}|null>(null)
const targetTripId=ref(''),log=ref<HTMLElement|null>(null),optimistic=ref<SendMessage|null>(null)
let baseline='',timer:ReturnType<typeof setTimeout>|undefined,disposed=false,epoch=0
let sendSequence=0,controller:AbortController|undefined,clockTimer:ReturnType<typeof setInterval>|undefined
const plan=computed(()=>conversation.value?.currentPlan||null)
const busy=computed(()=>sending.value||Boolean(conversation.value?.processing))
const elapsed=computed(()=>startedAt.value?Math.floor((now.value-startedAt.value)/1000):0)
const visibleMessages=computed(()=>{
  const messages=conversation.value?.messages||[]
  return messages.filter((m,i)=>m.status!=='FAILED' || !(optimistic.value?.content===m.content || messages.slice(i+1).some(next=>next.role==='user'&&next.content===m.content)))
})
const editable=computed(()=>plan.value?.status==='DRAFT'&&!busy.value&&!saving.value&&!syncing.value)
const dirty=computed(()=>Boolean(plan.value)&&JSON.stringify(days.value)!==baseline)
const compatibleTrips=computed(()=>trips.value.filter(t=>t.destination===conversation.value?.conditions.destination&&t.startDate===conversation.value?.conditions.startDate&&t.endDate===conversation.value?.conditions.endDate))
const targetTripTitle=computed(()=>trips.value.find(t=>t.tripId===targetTripId.value)?.title||'关联旅行')
const key=()=>`chat-edit:${id.value}`
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T}
function scroll(){nextTick(()=>{if(log.value)log.value.scrollTop=log.value.scrollHeight})}
function remember(){if(loading.value)return;try{sessionStorage.setItem(key(),JSON.stringify({planId:plan.value?.aiPlanId,version:conversation.value?.version,days:days.value,input:input.value,request:optimistic.value}))}catch{/* Private storage can be disabled. */}}
function apply(detail:Conversation,preserveEdits=false){
  if(conversation.value && detail.version<conversation.value.version)return
  const keepEdits=preserveEdits&&dirty.value&&detail.currentPlan?.aiPlanId===plan.value?.aiPlanId
  const follow= !log.value || log.value.scrollHeight-log.value.scrollTop-log.value.clientHeight<90
  conversation.value=detail
  const incoming=clone(detail.currentDays||detail.currentPlan?.days||[])
  if(!keepEdits)days.value=incoming
  baseline=JSON.stringify(incoming)
  targetTripId.value=detail.currentPlan?.tripId||(compatibleTrips.value.some(t=>t.tripId===targetTripId.value)?targetTripId.value:'')||compatibleTrips.value[0]?.tripId||''
  if(optimistic.value){
    const message=detail.messages.find(m=>m.requestId===optimistic.value?.requestId)
    if(message && message.status!=='PENDING'){
      sendSequence++;sending.value=false;optimistic.value=null;startedAt.value=0
      if(message.status==='COMPLETED'){input.value='';failure.value=''}else failure.value=message.errorMessage||'这次没有完成回复，原方案已保留'
    }
  }
  if(follow)scroll()
}
async function load(restore=false,preserveEdits=false){
  const run=epoch
  const detail=await conversationApi.detail(id.value)
  if(disposed||run!==epoch)return
  apply(detail,preserveEdits)
  if(restore){
    try{
      const cached=JSON.parse(sessionStorage.getItem(key())||'null')
      if(cached){
        const receipt=cached.request?detail.messages.find(m=>m.requestId===cached.request.requestId&&m.role==='user'):null
        input.value=receipt?.status==='COMPLETED'?'':cached.input||''
        if(cached.planId===plan.value?.aiPlanId&&cached.version===detail.version&&Array.isArray(cached.days))days.value=cached.days
        if(cached.request&&(!receipt||receipt.status==='PENDING'))optimistic.value=cached.request
      }
    }catch{/* Ignore damaged cache. */}
  }
  schedulePoll()
}
function schedulePoll(){
  if(timer)clearTimeout(timer)
  if((!conversation.value?.processing&&!sending.value)||disposed)return
  timer=setTimeout(async()=>{try{await load(false,true)}catch(e){failure.value='暂时无法同步状态，可点击“查询发送状态”。'+(e as Error).message;schedulePoll()}},2500)
}
async function refresh(){
  if(refreshing.value)return
  refreshing.value=true
  try{await load(false,true)}catch(e){failure.value=(e as Error).message}finally{refreshing.value=false}
}
function payloadDays(){return days.value.map(d=>({...d,items:d.items.map((item,i)=>({...item,itemName:item.itemName.trim(),startTime:item.startTime||null,endTime:item.endTime||null,transportation:item.transportation||null,note:item.note||null,sortOrder:i+1,estimatedCost:Number(item.estimatedCost||0)}))}))}
function valid(){for(const day of days.value)for(const item of day.items){if(!item.itemName.trim()){ElMessage.warning('请补全活动名称');return false}if(item.startTime&&item.endTime&&item.endTime<item.startTime){ElMessage.warning('活动结束时间不能早于开始');return false}}return true}
async function send(fixedId?:string){
  if(!conversation.value||busy.value||saving.value||syncing.value||!input.value.trim()||!valid())return
  const run=epoch,content=input.value.trim()
  const currentDays=days.value.length?payloadDays():null
  const previous=optimistic.value
  const sameRequest=previous?.content===content&&previous.intent===intent.value&&JSON.stringify(previous.currentDays)===JSON.stringify(currentDays)
  const request:SendMessage=sameRequest&&previous?previous:{requestId:fixedId||crypto.randomUUID(),expectedVersion:conversation.value.version,content,intent:intent.value,currentDays}
  const sequence=++sendSequence
  controller?.abort();controller=new AbortController()
  optimistic.value=request;sending.value=true;startedAt.value=Date.now();now.value=Date.now();failure.value='';remember();scroll();schedulePoll()
  try{const detail=await conversationApi.send(id.value,request,controller.signal);if(run===epoch&&sequence===sendSequence&&!disposed){apply(detail);remember()}}
  catch(e){
    if(run!==epoch||sequence!==sendSequence||disposed)return
    failure.value=(e as Error).message
    try{await load(false,true)}catch{/* Keep typed message, local edits and request key for a safe manual retry. */}
    if(sequence===sendSequence && errorCode(e)===40900){optimistic.value=null;failure.value+='。会话已同步，请确认后再发送。'}
  }
  finally{if(run===epoch&&sequence===sendSequence&&!disposed){sending.value=false;if(!conversation.value?.processing)startedAt.value=0;remember();schedulePoll()}}
}
function retry(message:ChatMessage){input.value=message.content;optimistic.value=null;send()}
function composeKey(e:KeyboardEvent){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();send()}}
function discussDay(day:AiPlanDay){
  const question=`请调整第 ${day.dayNumber} 天（${day.date}）的安排，其他日期保持不变。我的想法是：`
  input.value=input.value.trim()?input.value.trim()+'\n'+question:question
  intent.value='REVISE';nextTick(()=>composer.value?.focus())
}
function requestSave(){if(!targetTripId.value){saveDialog.value=true;return}savePlan()}
async function saveDraft(){
  if(!conversation.value||!editable.value||!valid())return false
  syncing.value=true
  try{const detail=await conversationApi.edit(id.value,conversation.value.version,payloadDays());apply(detail);remember();ElMessage.success('草稿编辑已保存，正式行程未改变');return true}
  catch(e){failure.value=(e as Error).message;return false}finally{syncing.value=false}
}
async function savePlan(){
  if(!plan.value||!targetTripId.value||busy.value||saving.value||!valid())return
  if(dirty.value&&!(await saveDraft()))return
  saving.value=true;failure.value=''
  const submit=(confirmOverwrite:boolean)=>aiApi.save(plan.value!.aiPlanId,{tripId:targetTripId.value,confirmOverwrite,days:payloadDays()})
  try{
    try{await submit(false)}catch(e){
      if(errorCode(e)!==40900)throw e
      const latest=await aiApi.detail(plan.value.aiPlanId)
      if(latest.status!=='DRAFT'){await load();ElMessage.info('该版本已经保存，请查看正式旅行');return}
      try{await ElMessageBox.confirm('目标旅行已有行程，保存将替换活动安排，已有消费会保留。是否覆盖？','覆盖已有行程',{confirmButtonText:'覆盖保存',cancelButtonText:'取消',type:'warning'})}catch{return}
      await submit(true)
    }
    await load();saveDialog.value=false;ElMessage.success('方案已保存到旅行，可以继续提问或生成另一版')
  }catch(e){failure.value=(e as Error).message}finally{saving.value=false}
}
async function deleteConversation(){
  if(busy.value)return
  try{await ElMessageBox.confirm(`删除「${conversation.value?.title}」及其全部聊天消息后无法恢复。生成的方案与正式旅行会保留。确定继续吗？`,'删除会话',{confirmButtonText:'删除',cancelButtonText:'取消',type:'warning'})}catch{return}
  try{await conversationApi.remove(id.value);sessionStorage.removeItem(key());ElMessage.success('会话已删除');router.replace('/ai')}catch(e){failure.value=(e as Error).message}
}
function tripCreated(trip:Trip){trips.value.unshift(trip);targetTripId.value=trip.tripId}
async function enter(){
  epoch++;sendSequence++;controller?.abort();sending.value=false;startedAt.value=0;if(timer)clearTimeout(timer);loading.value=true;failure.value='';optimistic.value=null;conversation.value=null;days.value=[];baseline='';input.value='';intent.value='AUTO';targetTripId.value='';saveDialog.value=false;tripDialog.value=false
  try{
    await load(true)
    trips.value=await tripApi.options().catch(()=>[])
    if(!targetTripId.value)targetTripId.value=compatibleTrips.value[0]?.tripId||''
    loading.value=false
    const active=conversation.value as Conversation|null
    if(route.query.start==='1'&&active&&!active.messages.length){input.value=active.conditions.requirements||'请根据旅行条件生成完整的旅行方案';intent.value='REVISE';await router.replace({path:route.path,query:{}});await send('initial-'+id.value);intent.value='AUTO'}
  }catch(e){failure.value=(e as Error).message}finally{loading.value=false}
}
watch([days,input],remember,{deep:true})
watch(id,enter)
onMounted(()=>{clockTimer=setInterval(()=>{now.value=Date.now()},1000);enter()})
onBeforeUnmount(()=>{disposed=true;epoch++;sendSequence++;controller?.abort();if(timer)clearTimeout(timer);if(clockTimer)clearInterval(clockTimer)})
onBeforeRouteLeave(async()=>{if(busy.value){try{await ElMessageBox.confirm('回复还在处理中，离开后可从会话列表回来查看结果。确定离开吗？','离开对话')}catch{return false}}else if(dirty.value){try{await ElMessageBox.confirm('有未提交的草稿编辑，是否留在这里保存？','草稿尚未同步',{confirmButtonText:'离开',cancelButtonText:'继续编辑'})}catch{return false}}remember()})
</script>
<style scoped>
.conversation-layout>.tp-card{margin-top:0}.conversation-layout{display:grid;grid-template-columns:minmax(320px,.92fr) minmax(0,1.08fr);gap:24px;align-items:stretch;height:calc(100dvh - 208px);min-height:580px}.conversation-error{margin-bottom:16px}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.chat-workspace,.plan-workspace{display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden}.chat-heading{padding:16px 24px;border-bottom:1px solid #e9eef6}.chat-heading strong{font-size: var(--tp-font-section)}.chat-heading span{display:block;color:var(--tp-text-secondary);font-size: var(--tp-font-body);margin-top:4px}.chat-log{flex:1;min-height:180px;overflow:auto;padding:24px;overscroll-behavior:contain}.chat-welcome h2{font-size: var(--tp-font-section)}.chat-welcome p{font-size: var(--tp-font-body);line-height:1.9;color:var(--tp-primary)}.chat-message{margin-bottom:24px}.chat-speaker{font-size: var(--tp-font-body);color:var(--tp-text-secondary);margin-bottom:8px}.chat-bubble{padding:12px 16px;border-radius:12px;background:#f4f6fa;white-space:pre-wrap;overflow-wrap:anywhere;font-size: var(--tp-font-body);line-height:1.9}.chat-message--user .chat-bubble{background:#edf3ff;color:var(--tp-primary)}.chat-message--user{margin-left:24px}.chat-message--assistant{margin-right:12px}.message-state,.thinking{color:var(--tp-text-secondary);font-size: var(--tp-font-body);margin-top:8px;line-height:1.7}.message-failed{font-size: var(--tp-font-body);color:var(--el-color-danger);line-height:1.8}.chat-memory{padding:12px 24px;border-top:1px solid #edf0f7;color:var(--tp-text-secondary);font-size: var(--tp-font-body);flex-shrink:0}.chat-memory p{line-height:1.7;white-space:pre-wrap;max-height:100px;overflow:auto}.chat-composer{border-top:1px solid #e9eef6;padding:16px 16px;flex-shrink:0;background:#fdfefe}.composer-toolbar,.composer-footer{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}.composer-toolbar{margin-bottom:8px}.composer-toolbar span,.composer-footer small{font-size: var(--tp-font-body);color:var(--tp-text-secondary)}.composer-footer{margin-top:8px}.intent-label{font-size: var(--tp-font-body);color:var(--tp-primary)}.chat-composer :deep(.el-textarea__inner){font-size: var(--tp-font-body);line-height:1.7;box-shadow:0 0 0 1px #e4eaf3 inset}.plan-heading{padding:16px 24px;display:flex;justify-content:space-between;align-items:center;gap:12px;border-bottom:1px solid #e9eef6}.panel-eyebrow{color:var(--tp-text-secondary);font-size: var(--tp-font-body);letter-spacing:1.6px}.plan-heading h2{font-size: var(--tp-font-section);margin:4px 0 0;color:var(--tp-primary)}.plan-empty{flex:1;display:grid;place-items:center}.plan-footer{padding:12px 16px;border-top:1px solid #e9eef6;background:#fff;flex-shrink:0}.save-context{display:flex;align-items:center;gap:4px;font-size: var(--tp-font-body);color:var(--tp-text-secondary);flex-wrap:wrap;line-height:1.6}.save-context small{font-size: var(--tp-font-body)}.save-context .el-button{padding:0;font-size: var(--tp-font-body);height:auto}.save-dot{height:5px;width:5px;background:#67aa93;border-radius:50%;flex-shrink:0}.save-dot--edited{background:#d9a352}.save-controls{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;flex-wrap:wrap}.save-controls .el-button{margin:0}.save-dialog-hint{font-size: var(--tp-font-body);color:var(--tp-text-secondary);line-height:1.8;margin:0 0 16px}@media(min-width:1101px){.conversation-page .page-header{margin-bottom:16px}}@media(max-width:1100px){.conversation-layout{grid-template-columns:1fr;height:auto;min-height:0}.chat-workspace{height:570px}.plan-workspace{height:760px}}@media(max-width:600px){.chat-workspace{height:530px}.plan-workspace{height:720px}.chat-heading,.plan-heading{padding:16px}.chat-log{padding:16px}.chat-message--user{margin-left:12px}.chat-memory{padding:8px 16px}.plan-footer{padding:12px 12px}.conversation-layout{gap:16px}.chat-composer{padding:12px}.composer-toolbar{gap:8px}.composer-toolbar>span{flex-basis:100%}}
</style>
