<template>
  <el-dialog :model-value="modelValue" title="景点详情" width="min(640px,94vw)" destroy-on-close @update:model-value="(value:boolean)=>emit('update:modelValue',value)">
    <div v-if="item">
      <h3>{{item.name}}</h3>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="城市">{{item.city}}</el-descriptions-item>
        <el-descriptions-item label="分类">{{item.category||'未分类'}}</el-descriptions-item>
        <el-descriptions-item label="建议游玩">{{durationText(item.suggestedDurationMinutes)}}</el-descriptions-item>
        <el-descriptions-item label="参考门票">{{item.referenceTicketPrice===null?'未填写':money(item.referenceTicketPrice)}}</el-descriptions-item>
        <el-descriptions-item label="描述">{{item.description||'暂无描述'}}</el-descriptions-item>
      </el-descriptions>
      <el-alert v-if="failure" :title="failure" type="error" :closable="false" role="alert"/>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue',false)">关闭</el-button>
      <template v-if="item">
        <el-button :loading="busy" @click="favorite">{{item.isFavorited?'取消收藏':'收藏'}}</el-button>
        <el-button v-if="item.isOwner" @click="editing=true">编辑景点</el-button>
        <el-button v-if="item.isOwner" type="danger" plain :disabled="busy" @click="remove">删除景点</el-button>
        <el-button type="primary" @click="addVisible=true">加入旅行行程</el-button>
      </template>
    </template>
    <AddToTripDialog v-model="addVisible" :attraction="item" :default-trip-id="defaultTripId"/>
    <AttractionFormDialog v-model="editing" :attraction="item" @saved="updated"/>
  </el-dialog>
</template>
<script setup lang="ts">
import {ref,watch} from 'vue'
import {ElMessage,ElMessageBox} from 'element-plus'
import type {Attraction} from '@/types/api'
import {durationText,money} from '@/utils/format'
import {errorMessage} from '@/utils/request'
import {attractionApi} from '@/api/attraction'
import {favoriteApi} from '@/api/favorite'
import AddToTripDialog from './AddToTripDialog.vue'
import AttractionFormDialog from './AttractionFormDialog.vue'
const props=defineProps<{modelValue:boolean;attraction:Attraction|null;defaultTripId?:string}>()
const emit=defineEmits<{(e:'update:modelValue',v:boolean):void;(e:'changed'):void}>()
const item=ref<Attraction|null>(null),addVisible=ref(false),editing=ref(false),busy=ref(false),failure=ref('')
watch(()=>[props.attraction,props.modelValue] as const,()=>{item.value=props.attraction?{...props.attraction}:null;failure.value='';editing.value=false},{immediate:true})
function updated(){emit('update:modelValue',false);emit('changed')}
async function favorite(){
  if(!item.value||busy.value)return
  if(item.value.isFavorited){try{await ElMessageBox.confirm(`取消收藏「${item.value.name}」？已安排的旅行活动会保留，可随时重新收藏。`,'取消收藏',{confirmButtonText:'取消收藏',cancelButtonText:'保留'})}catch{return}}
  busy.value=true;failure.value=''
  try{if(item.value.isFavorited)await favoriteApi.remove(item.value.attractionId);else await favoriteApi.add(item.value.attractionId);item.value.isFavorited=!item.value.isFavorited;ElMessage.success(item.value.isFavorited?'已收藏，可从我的收藏查看':'已取消收藏');emit('changed')}
  catch(e){failure.value=errorMessage(e)}finally{busy.value=false}
}
async function remove(){
  if(!item.value||busy.value)return
  try{await ElMessageBox.confirm(`删除「${item.value.name}」后，其收藏会一并删除；已有行程的活动名称保留，景点关联解除。删除后无法恢复。确定继续吗？`,'删除景点',{confirmButtonText:'删除',cancelButtonText:'取消',type:'warning'})}catch{return}
  busy.value=true;failure.value=''
  try{await attractionApi.remove(item.value.attractionId);ElMessage.success('景点已删除');emit('update:modelValue',false);emit('changed')}
  catch(e){failure.value=errorMessage(e)}finally{busy.value=false}
}
</script>
