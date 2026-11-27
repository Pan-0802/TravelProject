<template>
  <el-dialog :model-value="modelValue" title="把景点加入旅行" width="min(580px, 94vw)" :close-on-click-modal="false" @open="load" @update:model-value="emit('update:modelValue',$event)">
    <div v-if="attraction" class="selected-place"><strong>{{ attraction.name }}</strong><span>{{ attraction.city }} · {{ attraction.category || '景点' }}</span></div>
    <RequestError :message="loadFailure" :loading="loading" @retry="load"/>
    <el-form label-position="top">
      <el-form-item label="加入哪次旅行" required><el-select v-model="tripId" filterable placeholder="选择旅行" style="width:100%" :loading="loading" @change="date=selected?.startDate||''"><el-option v-for="t in trips" :key="t.tripId" :label="t.title+' · '+t.destination" :value="t.tripId"/></el-select><el-button text type="primary" @click="createVisible=true">新建旅行</el-button></el-form-item>
      <el-form-item label="安排在哪一天" required><el-select v-model="date" placeholder="先选择旅行" style="width:100%"><el-option v-for="d in dates" :key="d" :label="d" :value="d"/></el-select></el-form-item>
      <el-form-item label="开始游玩时间（可选）"><el-time-picker v-model="start" format="HH:mm" value-format="HH:mm" placeholder="选择时间"/></el-form-item>
      <p class="tp-muted">{{ start ? '会按开始时间自动插入当天对应时段。' : '未填写开始时间时放在当天末尾，补充时间后自动归位。' }}</p>
      <p v-if="attraction?.suggestedDurationMinutes" class="tp-muted">建议游玩 {{ attraction.suggestedDurationMinutes }} 分钟；保存时带入活动结束时间，可在行程中继续调整。</p>
      <el-form-item label="预计费用（元，可修改）"><el-input-number v-model="cost" :min="0" :max="99999999.99" :precision="2"/></el-form-item>
      <p class="tp-muted">预计费用只用于计划，不会自动记为实际消费。</p>
      <el-alert v-if="saveFailure" :title="saveFailure" type="error" :closable="false" role="alert"/>
    </el-form>
    <template #footer><el-button @click="emit('update:modelValue',false)">取消</el-button><el-button type="primary" :loading="saving" :disabled="!tripId||!date" @click="save">加入并查看行程</el-button></template>
    <TripFormDialog v-model="createVisible" :prefill="{title:(attraction?.city||'')+'旅行',destination:attraction?.city||''}" @saved="created"/>
  </el-dialog>
</template>
<script setup lang="ts">
import RequestError from "@/components/common/RequestError.vue"
import {errorMessage} from "@/utils/request"
import {computed,ref} from 'vue'
const loadFailure=ref(''),saveFailure=ref('')
import {useRouter} from 'vue-router'
import dayjs from 'dayjs'
import {ElMessage} from 'element-plus'
import {tripApi} from '@/api/trip'
import {itineraryApi} from '@/api/itinerary'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'
import type {Attraction,Trip} from '@/types/api'
const props=defineProps<{modelValue:boolean;attraction:Attraction|null;defaultTripId?:string}>()
const emit=defineEmits<{(e:'update:modelValue',v:boolean):void}>(),router=useRouter()
const trips=ref<Trip[]>([]),tripId=ref(''),date=ref(''),start=ref<string|null>(null),cost=ref(0),loading=ref(false),saving=ref(false),createVisible=ref(false)
const selected=computed(()=>trips.value.find(t=>t.tripId===tripId.value))
const dates=computed(()=>{const t=selected.value;if(!t)return [];const count=dayjs(t.endDate).diff(dayjs(t.startDate),'day')+1;return Array.from({length:Math.min(count,3660)},(_,i)=>dayjs(t.startDate).add(i,'day').format('YYYY-MM-DD'))})
async function load(){loading.value=true;loadFailure.value='';saveFailure.value='';start.value=null;cost.value=Number(props.attraction?.referenceTicketPrice||0);try{trips.value=await tripApi.options();const matched=trips.value.filter(t=>t.destination.replace(/市$/,'')===props.attraction?.city.replace(/市$/,''));tripId.value=props.defaultTripId|| (matched.length===1?matched[0]!.tripId:'');date.value=selected.value?.startDate||''}catch(e){loadFailure.value=errorMessage(e)}finally{loading.value=false}}
function created(t:Trip){trips.value=[t,...trips.value];tripId.value=t.tripId;date.value=t.startDate}
async function save(){if(!props.attraction||!selected.value||saving.value)return;saving.value=true;saveFailure.value='';try{
  const rows=await itineraryApi.days(tripId.value),day=rows.days.find(d=>d.date===date.value)
  const duration=props.attraction.suggestedDurationMinutes||0
  const finish=start.value&&duration?dayjs(date.value+'T'+start.value).add(duration,'minute'):null
  if(finish&&finish.format('YYYY-MM-DD')!==date.value){ElMessage.warning('游玩结束会跨天，请提前开始时间');return}
  await itineraryApi.createItem(tripId.value,date.value,{itemName:props.attraction.name,attractionId:props.attraction.attractionId,startTime:start.value,endTime:finish?.format('HH:mm')||null,estimatedCost:cost.value,sortOrder:(day?.items.length||0)+1})
  emit('update:modelValue',false);ElMessage.success(start.value?'景点已按开始时间排入行程':'景点已加入行程，时间待定');await router.push('/trips/'+tripId.value)
}catch(e){saveFailure.value=errorMessage(e)}finally{saving.value=false}}
</script>
<style scoped>.selected-place{display:flex;flex-direction:column;gap:8px;background:#eff5ff;padding:16px;border-radius:10px;margin-bottom:16px}.selected-place span{color:var(--tp-primary);font-size: var(--tp-font-body)}.tp-muted{font-size: var(--tp-font-body);line-height:1.7}</style>
