<template>
  <div class="plan-timeline">
    <div class="itinerary-overview">
      <div><span class="overview-label">整趟行程预计</span><strong>{{ money(total) }}</strong></div>
      <div class="overview-facts"><span>{{ modelValue.length }} 天</span><span>{{ count }} 项安排</span><span v-if="budget != null">预算 {{ money(budget) }}</span></div>
    </div>
    <nav class="day-tabs" role="tablist" aria-label="选择行程日期">
      <button v-for="(day,index) in modelValue" :key="day.date" role="tab" :aria-selected="activeDate===day.date" :aria-controls="panelId" :tabindex="activeDate===day.date?0:-1" @click="selectDay(day.date)" @keydown="tabKey($event,index)">
        <span>第 {{ day.dayNumber }} 天</span><small>{{ day.date.slice(5).replace('-',' / ') }}</small>
      </button>
    </nav>
    <section v-if="activeDay" :id="panelId" role="tabpanel" :aria-label="'第'+activeDay.dayNumber+'天行程'" class="day-content">
      <header class="day-heading">
        <div><p class="day-eyebrow">{{ activeDay.date }} · {{ activeDay.items.length }} 项安排</p><h3>{{ activeDay.description || '今天的旅行安排' }}</h3></div>
        <el-button v-if="editable" text size="small" @click="openDayEditor">编辑说明</el-button>
      </header>
      <div class="day-tools">
        <span>当日预计 <b>{{ money(dayTotal) }}</b></span>
        <div><el-button v-if="undoState && editable" text size="small" @click="undo">撤销上次修改</el-button><el-button v-if="editable&&activeDay&&needsTimeOrder(activeDay.items)" text size="small" @click="arrangeDay">按时间整理</el-button><el-button v-if="canDiscuss" text size="small" type="primary" @click="emit('discuss',activeDay)">让 AI 调整这一天</el-button><el-button v-if="editable" size="small" :disabled="activeDay.items.length>=50" :icon="Plus" @click="openActivity()">添加活动</el-button></div>
      </div>
      <el-empty v-if="!activeDay.items.length" description="这一天可以自由安排，也可以添加活动" :image-size="72"/>
      <ol v-else class="activity-timeline">
        <li v-for="(item,index) in activeDay.items" :key="activityKey(item)" class="timeline-activity">
          <div class="timeline-time"><strong>{{ item.startTime || '待定' }}</strong><small v-if="item.endTime">{{ item.endTime }}</small></div>
          <div class="timeline-marker" :class="{'timeline-marker--food': isMeal(item)}"><span></span></div>
          <div class="activity-card">
            <div class="activity-card__heading"><h4>{{ item.itemName }}</h4><div class="activity-actions" v-if="editable"><el-button text size="small" :aria-label="'编辑：'+item.itemName" @click="openActivity(index)"><el-icon><EditPen/></el-icon><span>编辑</span></el-button><el-dropdown trigger="click" @command="(command:unknown)=>itemCommand(String(command),index)"><el-button text size="small" :aria-label="'更多操作：'+item.itemName"><el-icon><MoreFilled/></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="up" :disabled="index===0">上移</el-dropdown-item><el-dropdown-item command="down" :disabled="index===activeDay.items.length-1">下移</el-dropdown-item><el-dropdown-item divided command="remove">移除活动</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></div>
            <div class="activity-meta"><span v-if="conflicts[index]?.length" class="overlap-label" :title="'与 '+conflicts[index]!.join('、')+' 时间重叠'">时间重叠</span><span v-if="isMeal(item)" class="meal-label">用餐</span><span v-if="item.transportation">{{ item.transportation }}</span><span>{{ Number(item.estimatedCost)>0?'预计 '+money(item.estimatedCost):'未列费用' }}</span></div>
            <p v-if="item.note" class="activity-note" :class="{'activity-note--expanded':expanded.has(index)}">{{ item.note }}</p>
            <button v-if="item.note && item.note.length>75" class="note-toggle" @click="toggleNote(index)">{{ expanded.has(index)?'收起备注':'展开备注' }}</button>
          </div>
        </li>
      </ol>
    </section>
    <p class="itinerary-footnote">时间与费用为旅行建议，预约和营业信息请在出行前确认。</p>

    <el-dialog v-model="editorVisible" :title="editingIndex===null?'添加活动':'编辑活动'" width="min(540px, 94vw)" append-to-body :close-on-click-modal="false" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="activity-edit-form" @submit.prevent="commitActivity">
        <el-form-item label="活动名称" prop="itemName"><el-input v-model="form.itemName" maxlength="150" show-word-limit placeholder="填写景点、餐饮或其他安排" autofocus/></el-form-item>
        <el-form-item label="活动时间" prop="endTime"><div class="edit-time-row"><el-time-picker v-model="form.startTime" format="HH:mm" value-format="HH:mm" placeholder="开始时间"/><span>至</span><el-time-picker v-model="form.endTime" format="HH:mm" value-format="HH:mm" placeholder="结束时间"/></div><p class="edit-placement-hint">填写或修改开始时间后，会自动排入当天对应时段。</p><p v-if="editorConflicts.length" class="edit-overlap-hint" role="status">与 {{ editorConflicts.join('、') }} 时间重叠，请确认安排。</p></el-form-item>
        <div class="edit-fields-row"><el-form-item label="到达方式" prop="transportation"><el-select v-model="form.transportation" filterable allow-create clearable placeholder="可选"><el-option v-for="t in TRANSPORTATION_OPTIONS" :key="t" :label="t" :value="t"/></el-select></el-form-item><el-form-item label="预计费用（元）" prop="estimatedCost"><el-input-number v-model="form.estimatedCost" :min="0" :max="99999999.99" :precision="2" controls-position="right"/></el-form-item></div>
        <el-form-item label="备注" prop="note"><el-input v-model="form.note" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="预约、休息或你的补充说明"/></el-form-item>
        <p v-if="editorError" class="editor-error" role="alert">{{ editorError }}</p>
      </el-form>
      <template #footer><el-button @click="editorVisible=false">取消</el-button><el-button type="primary" @click="commitActivity">应用修改</el-button></template>
    </el-dialog>
    <el-dialog v-model="dayEditorVisible" title="编辑当天说明" width="min(500px, 94vw)" append-to-body :close-on-click-modal="false"><el-input v-model="dayDescription" type="textarea" :rows="3" maxlength="255" show-word-limit placeholder="例如：老城散步，慢慢逛和吃"/><template #footer><el-button @click="dayEditorVisible=false">取消</el-button><el-button type="primary" @click="commitDescription">应用修改</el-button></template></el-dialog>
  </div>
</template>
<script setup lang="ts">
import {computed,nextTick,reactive,ref,useId,watch} from 'vue'
import {ElMessage,type FormInstance,type FormRules} from 'element-plus'
import {EditPen,MoreFilled,Plus} from '@element-plus/icons-vue'
import type {AiPlanDay,AiPlanItem} from '@/types/api'
import {TRANSPORTATION_OPTIONS} from '@/constants'
import {money} from '@/utils/format'
import {byStartTime,insertByTime,needsTimeOrder,timeConflicts} from '@/utils/schedule'

const props=defineProps<{modelValue:AiPlanDay[];editable:boolean;budget?:number|null;canDiscuss?:boolean}>()
const emit=defineEmits<{(e:'update:modelValue',days:AiPlanDay[]):void;(e:'discuss',day:AiPlanDay):void}>()
const panelId='itinerary-'+useId(),activeDate=ref(''),expanded=ref(new Set<number>())
const activeDay=computed(()=>props.modelValue.find(d=>d.date===activeDate.value))
const count=computed(()=>props.modelValue.reduce((n,d)=>n+d.items.length,0))
const total=computed(()=>props.modelValue.reduce((n,d)=>n+d.items.reduce((s,i)=>s+Number(i.estimatedCost||0),0),0))
const conflicts=computed(()=>activeDay.value?.items.map((item,index)=>timeConflicts(item,activeDay.value!.items.filter((_,i)=>i!==index)))||[])
const editorConflicts=computed(()=>timeConflicts(form,props.modelValue.find(d=>d.date===editorDate.value)?.items.filter((_,i)=>i!==editingIndex.value)||[]))
const dayTotal=computed(()=>activeDay.value?.items.reduce((n,i)=>n+Number(i.estimatedCost||0),0)||0)
const undoState=ref<AiPlanDay[]|null>(null)
const editorVisible=ref(false),dayEditorVisible=ref(false),dayDescription=ref(''),editingIndex=ref<number|null>(null),editorDate=ref(''),editorError=ref('')
const formRef=ref<FormInstance>(),form=reactive<AiPlanItem>(blank())
let editorSource='',lastEmission='',keyCounter=0
const itemKeys=new WeakMap<object,number>()
function activityKey(item:AiPlanItem){if(!itemKeys.has(item))itemKeys.set(item,++keyCounter);return itemKeys.get(item)!}
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value))
const rules:FormRules={
  itemName:[{required:true,whitespace:true,message:'请填写活动名称',trigger:'blur'},{max:150,message:'活动名称最多150字，请缩短后重试',trigger:'blur'}],
  endTime:[{validator:(_rule,value,callback)=>{
    if(form.startTime&&value&&value<form.startTime)return callback(new Error('结束时间不能早于开始时间，请调整时间段'))
    callback()
  },trigger:'change'}],
  transportation:[{max:60,message:'到达方式最多60字，请缩短后重试',trigger:'change'}],
  estimatedCost:[{validator:(_rule,value,callback)=>{
    if(value===null||value===undefined||!Number.isFinite(Number(value))||Number(value)<0||Number(value)>99999999.99)return callback(new Error('请填写0至99999999.99元之间的费用'))
    callback()
  },trigger:'change'}],
  note:[{max:500,message:'备注最多500字，请精简后重试',trigger:'blur'}]
}
function blank():AiPlanItem{return {itemName:'',startTime:null,endTime:null,sortOrder:1,transportation:null,estimatedCost:0,note:null,attractionId:null}}
function isMeal(item:AiPlanItem){return /早餐|午餐|晚餐|午饭|晚饭|用餐|美食|餐厅|餐馆|火锅|小吃|烧烤|咖啡|牛肉|烤鸭/.test(item.itemName)}
function selectDay(date:string){activeDate.value=date;expanded.value=new Set()}
function tabKey(event:KeyboardEvent,index:number){let target=index;if(event.key==='ArrowRight')target=(index+1)%props.modelValue.length;else if(event.key==='ArrowLeft')target=(index+props.modelValue.length-1)%props.modelValue.length;else if(event.key==='Home')target=0;else if(event.key==='End')target=props.modelValue.length-1;else return;event.preventDefault();const tabs=(event.currentTarget as HTMLElement|null)?.parentElement;selectDay(props.modelValue[target]!.date);nextTick(()=>tabs?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus())}
function toggleNote(index:number){const value=new Set(expanded.value);value.has(index)?value.delete(index):value.add(index);expanded.value=value}
function publish(days:AiPlanDay[]){undoState.value=clone(props.modelValue);days.forEach(d=>d.items.forEach((item,i)=>{item.sortOrder=i+1}));lastEmission=JSON.stringify(days);emit('update:modelValue',days)}
function undo(){if(!props.editable||!undoState.value)return;const previous=undoState.value;undoState.value=null;lastEmission=JSON.stringify(previous);emit('update:modelValue',previous)}
function openActivity(index?:number){if(!props.editable||!activeDay.value)return;editingIndex.value=index??null;editorDate.value=activeDay.value.date;const source=index===undefined?blank():activeDay.value.items[index]!;Object.assign(form,blank(),clone(source));editorSource=JSON.stringify(activeDay.value);editorError.value='';editorVisible.value=true;nextTick(()=>formRef.value?.clearValidate())}
async function commitActivity(){
  if(!props.editable)return
  if(!(await formRef.value?.validate().catch(()=>false)))return
  const days=clone(props.modelValue),day=days.find(d=>d.date===editorDate.value)
  if(!day||JSON.stringify(day)!==editorSource){editorError.value='这一天已更新，请关闭后重新编辑';return}
  const item={...clone(form),itemName:form.itemName.trim(),startTime:form.startTime||null,endTime:form.endTime||null,transportation:form.transportation||null,note:form.note?.trim()||null,estimatedCost:Number(form.estimatedCost||0)}
  const previous=editingIndex.value===null?null:day.items[editingIndex.value]
  if(editingIndex.value===null&&day.items.length>=50){editorError.value='一天最多安排50项活动';return}
  if((!previous&&item.startTime)||(previous&&(previous.startTime||null)!==item.startTime))day.items=insertByTime(day.items,item,editingIndex.value??undefined)
  else if(editingIndex.value===null)day.items.push(item)
  else day.items[editingIndex.value]=item
  publish(days);editorVisible.value=false
}
function arrangeDay(){if(!props.editable||!activeDay.value)return;const days=clone(props.modelValue);days.find(d=>d.date===activeDate.value)!.items=byStartTime(activeDay.value.items).map(item=>clone(item));publish(days);expanded.value=new Set()}
function itemCommand(command:string,index:number){if(!props.editable||!activeDay.value)return;const days=clone(props.modelValue),day=days.find(d=>d.date===activeDate.value)!;if(command==='remove')day.items.splice(index,1);else{const target=index+(command==='up'?-1:1);if(target<0||target>=day.items.length)return;const item=day.items.splice(index,1)[0]!;day.items.splice(target,0,item)}publish(days);expanded.value=new Set()}
function openDayEditor(){if(!activeDay.value||!props.editable)return;editorDate.value=activeDay.value.date;dayDescription.value=activeDay.value.description||'';editorSource=JSON.stringify(activeDay.value);dayEditorVisible.value=true}
function commitDescription(){if(!props.editable)return;const days=clone(props.modelValue),day=days.find(d=>d.date===editorDate.value);if(!day||JSON.stringify(day)!==editorSource){ElMessage.info('这一天已更新，请重新编辑');return}day.description=dayDescription.value.trim()||null;publish(days);dayEditorVisible.value=false}
watch(()=>props.modelValue,days=>{if(!days.some(d=>d.date===activeDate.value))activeDate.value=days[0]?.date||'';if(JSON.stringify(days)!==lastEmission)undoState.value=null},{immediate:true,deep:true})
watch(()=>props.editable,value=>{if(!value){editorVisible.value=false;dayEditorVisible.value=false}})
</script>
<style scoped>
.plan-timeline{display:flex;flex-direction:column;min-height:0;flex:1;color:var(--tp-primary)}.itinerary-overview{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 24px;background:linear-gradient(110deg,#f1f6ff,#f9fbff);border-bottom:1px solid #e9eef6}.overview-label{display:block;font-size: var(--tp-font-body);color:var(--tp-primary);margin-bottom:4px}.itinerary-overview strong{font-size: var(--tp-font-title);letter-spacing:-.6px;color:var(--tp-primary)}.overview-facts{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px 12px;color:var(--tp-primary);font-size: var(--tp-font-body)}.day-tabs{display:flex;gap:8px;overflow-x:auto;padding:12px 16px 12px;border-bottom:1px solid #e9eef6;flex-shrink:0}.day-tabs button{flex-shrink:0;min-width:86px;display:grid;gap:4px;text-align:center;border:1px solid transparent;background:#f4f6fa;border-radius:9px;padding:8px 16px;color:var(--tp-primary);cursor:pointer;font:inherit;font-size: var(--tp-font-body)}.day-tabs button[aria-selected=true]{color:var(--tp-primary);background:#edf3ff;border-color:#afc8ff}.day-tabs small{font-size: var(--tp-font-body);letter-spacing:.3px}.day-tabs button:focus-visible,.note-toggle:focus-visible{outline:2px solid #409eff;outline-offset:2px}.day-content{overflow:auto;padding:16px 24px 8px;min-height:0;flex:1;overscroll-behavior:contain}.day-heading{display:flex;align-items:flex-start;gap:8px;justify-content:space-between}.day-heading>div{min-width:0}.day-eyebrow{font-size: var(--tp-font-body);color:var(--tp-text-secondary);margin:0 0 8px}.day-heading h3{font-size: var(--tp-font-section);line-height:1.6;margin:0;font-weight:600;overflow-wrap:anywhere}.day-heading .el-button{margin-top:16px;flex-shrink:0}.day-tools{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:8px 0 16px;font-size: var(--tp-font-body);color:var(--tp-text-secondary);flex-wrap:wrap}.day-tools>div{display:flex;align-items:center;gap:4px;flex-wrap:wrap}.day-tools .el-button{margin:0}.day-tools b{font-weight:500;color:var(--tp-primary)}.activity-timeline{margin:0;padding:0;list-style:none}.timeline-activity{display:grid;grid-template-columns:47px 17px minmax(0,1fr);gap:8px;position:relative;padding-bottom:16px}.timeline-time{padding-top:12px;display:flex;align-items:flex-end;flex-direction:column;gap:4px;font-variant-numeric:tabular-nums}.timeline-time strong{font-size: var(--tp-font-body);font-weight:600;color:var(--tp-primary)}.timeline-time small{font-size: var(--tp-font-body);color:var(--tp-text-secondary)}.timeline-marker{position:relative;display:flex;justify-content:center}.timeline-marker:after{content:'';position:absolute;top:22px;bottom:-17px;width:1px;background:#e2e8f3}.timeline-activity:last-child .timeline-marker:after{display:none}.timeline-marker>span{z-index:1;background:#688fe0;border:4px solid #eaf1ff;width:14px;height:14px;border-radius:50%;margin-top:12px}.timeline-marker--food>span{background:#d6a152;border-color:#fff4e4}.activity-card{padding:12px 12px 12px;border:1px solid #e7ecf3;border-radius:10px;background:#fff;min-width:0}.activity-card__heading{display:flex;align-items:flex-start;justify-content:space-between;gap:4px}.activity-card h4{font-size: var(--tp-font-body);margin:4px 0 0;font-weight:600;line-height:1.6;overflow-wrap:anywhere}.activity-actions{display:flex;align-items:center;flex-shrink:0}.activity-actions .el-button{margin:0;padding:4px;font-size: var(--tp-font-body)}.activity-actions :deep(.el-icon){margin-right:4px}.activity-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size: var(--tp-font-body);color:var(--tp-text-secondary);margin-top:8px}.meal-label{color:var(--tp-text-secondary);background:#fff7e9;border-radius:4px;padding:4px 4px}.activity-note{font-size: var(--tp-font-body);color:var(--tp-text-secondary);line-height:1.7;margin:8px 0 0;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;white-space:pre-wrap;overflow-wrap:anywhere}.activity-note--expanded{display:block}.note-toggle{font:inherit;font-size: var(--tp-font-body);color:var(--tp-primary);border:0;background:transparent;padding:4px 0 0;cursor:pointer}.itinerary-footnote{margin:0;padding:12px 16px;border-top:1px solid #edf0f6;color:var(--tp-text-secondary);font-size: var(--tp-font-body);line-height:1.6;flex-shrink:0}.edit-time-row{display:flex;align-items:center;gap:8px;width:100%;color:var(--tp-text-secondary)}.edit-time-row :deep(.el-date-editor){width:0;flex:1;min-width:0}.edit-fields-row{display:grid;grid-template-columns:1fr 1fr;gap:16px}.edit-fields-row .el-input-number,.edit-fields-row .el-select{width:100%}.edit-placement-hint,.edit-overlap-hint{width:100%;font-size: var(--tp-font-body);line-height:1.6;margin:4px 0 0;color:var(--tp-text-secondary)}.edit-overlap-hint{color:var(--tp-text-secondary)}.overlap-label{color:var(--tp-text-secondary);background:#fff7e9;border-radius:4px;padding:4px 4px}.editor-error{font-size: var(--tp-font-body);color:var(--el-color-danger);margin:0}.activity-edit-form :deep(.el-form-item__label){font-size: var(--tp-font-body);color:var(--tp-primary)}@media(max-width:600px){.itinerary-overview{padding:16px;gap:8px}.itinerary-overview strong{font-size: var(--tp-font-title)}.overview-facts{max-width:180px;gap:4px 8px;font-size: var(--tp-font-body)}.day-tabs{padding:12px 12px}.day-tabs button{min-width:76px;padding:8px 12px}.day-content{padding:16px 12px 8px}.timeline-activity{grid-template-columns:38px 12px minmax(0,1fr);gap:4px}.timeline-time strong{font-size: var(--tp-font-body)}.activity-card{padding:8px}.activity-card h4{font-size: var(--tp-font-body)}.activity-actions .el-button span{font-size: var(--tp-font-body)}.itinerary-footnote{padding:8px 12px}.edit-fields-row{gap:8px}}
.activity-edit-form :deep(.el-form-item.is-error .edit-placement-hint),
.activity-edit-form :deep(.el-form-item.is-error .edit-overlap-hint) { display:none; }
.edit-fields-row { grid-template-columns:repeat(2,minmax(0,1fr)); }
.edit-fields-row > * { min-width:0; }
.activity-edit-form :deep(.el-form-item__label) { color:var(--tp-text); }
</style>
