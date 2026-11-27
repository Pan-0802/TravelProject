<template>
  <div class="page">
    <div class="page-header">
      <div><h1 class="page-title">旅行计划</h1><p class="page-subtitle">创建计划、查看每日安排、记录消费。</p></div>
      <div><el-button @click="router.push('/ai')">让 AI 帮我安排</el-button><el-button type="primary" :icon="Plus" @click="dialogVisible=true">新建旅行</el-button></div>
    </div>
    <div class="tp-card tp-card__body">
      <div class="tp-toolbar">
        <el-input v-model.trim="query.keyword" placeholder="搜索旅行名称 / 目的地" clearable class="search-input" :prefix-icon="Search" @keyup.enter="search" @clear="search" />
        <el-select v-model="query.status" placeholder="全部状态" clearable class="filter-select" @change="search"><el-option label="未开始" value="NOT_STARTED"/><el-option label="进行中" value="ONGOING"/><el-option label="已结束" value="FINISHED"/></el-select>
        <el-button @click="search">查询</el-button><el-button text @click="reset">重置</el-button><div class="tp-toolbar__spacer"/><el-button :icon="Refresh" text @click="loadTrips">刷新</el-button>
      </div>
      <RequestError :message="failure" :loading="loading" @retry="loadTrips" />
      <el-table max-height="calc(100dvh - 320px)" v-if="!failure" v-loading="loading" :data="trips" stripe row-key="tripId" @row-dblclick="(row:Trip)=>goDetail(row.tripId)">
        <el-table-column prop="title" label="旅行" min-width="220" show-overflow-tooltip />
        <el-table-column prop="destination" label="目的地" min-width="120" show-overflow-tooltip />
        <el-table-column label="日期" width="240" align="right"><template #default="{row}">{{row.startDate}} 至 {{row.endDate}}<div class="tp-muted">共 {{row.daysCount}} 天</div></template></el-table-column>
        <el-table-column label="预算 / 支出" width="184" align="right"><template #default="{row}"><div class="tp-money">{{money(row.totalBudget)}}</div><div class="tp-muted">已支出 {{money(row.actualExpense)}}</div></template></el-table-column>
        <el-table-column label="状态" width="104"><template #default="{row}"><el-tag effect="plain" type="info">{{TRIP_STATUS_LABELS[row.tripStatus as TripStatus]}}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="88" fixed="right"><template #default="{row}"><el-button link type="primary" @click="goDetail(row.tripId)">详情</el-button></template></el-table-column>
        <template #empty><el-empty v-if="!loading" :description="query.keyword||query.status?'没有匹配的记录，请调整或清空检索条件':'还没有旅行计划，创建第一趟旅行吧'"><el-button v-if="query.keyword||query.status" @click="reset">清空条件</el-button><el-button v-else type="primary" @click="dialogVisible=true">新建旅行</el-button></el-empty></template>
      </el-table>
      <ListPagination v-if="!failure" :page="query.page" :total="total" @change="changePage" />
    </div>
    <TripFormDialog v-model="dialogVisible" @saved="created" />
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import { tripApi } from '@/api/trip'
import TripFormDialog from '@/components/trip/TripFormDialog.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import RequestError from '@/components/common/RequestError.vue'
import { TRIP_STATUS_LABELS } from '@/constants'
import type { Trip, TripStatus } from '@/types/api'
import { money } from '@/utils/format'
import { errorMessage } from '@/utils/request'
const router=useRouter(),trips=ref<Trip[]>([]),total=ref(0),loading=ref(false),failure=ref(''),dialogVisible=ref(false)
const query=reactive({page:1,size:20,keyword:'',status:'' as TripStatus|''})
let sequence=0
async function loadTrips(){
  const run=++sequence;loading.value=true;failure.value=''
  try{const result=await tripApi.list({...query});if(run!==sequence)return;trips.value=result.list;total.value=result.total}
  catch(error){if(run===sequence)failure.value=errorMessage(error,'查询失败，请重试；筛选条件已保留。')}
  finally{if(run===sequence)loading.value=false}
}
function search(){query.page=1;loadTrips()}
function reset(){query.keyword='';query.status='';search()}
function changePage(page:number){query.page=page;loadTrips()}
function goDetail(id:string){router.push('/trips/'+id)}
function created(trip:Trip){goDetail(trip.tripId)}
onMounted(loadTrips)
</script>
