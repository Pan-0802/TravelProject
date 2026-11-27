<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">景点探索</h1>
        <p class="page-subtitle">
          搜索地点后点击录入，自动带入基本信息；确认保存后即可收藏或关联到行程。
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreate">新增自建景点</el-button>
    </div>

    <el-alert v-if="contextTrip" type="info" :closable="false" :title="'正在为「'+contextTrip.title+'」挑选景点，保存后可直接安排到某一天。'" style="margin-bottom:16px"><el-button text type="primary" @click="router.push('/trips/'+contextTrip.tripId)">返回旅行</el-button></el-alert>
    <div v-if="recentAttraction" class="tp-card tp-card__body" style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><span>「{{ recentAttraction.name }}」已保存，接下来安排到哪一天？</span><el-button type="primary" @click="addToTrip(recentAttraction)">加入旅行行程</el-button></div>
    <!-- 高德实时 POI -->
    <div class="tp-card tp-card__body">
      <div class="section-head">
        <div>
          <h2 class="section-title">高德实时搜索</h2>
          <p class="section-desc">点击结果可预填名称、城市和分类，核对后保存为本地景点。</p>
        </div>
        <el-tag type="info" effect="plain">实时查询 · 确认后录入</el-tag>
      </div>

      <div class="tp-toolbar">
        <el-input
          v-model.trim="poiQuery.keywords"
          placeholder="关键词，如：博物馆"
          clearable
          maxlength="80"
          style="width: 260px"
          :prefix-icon="Search"
          @keyup.enter="searchPoi"
        />
        <CityCascader v-model="poiQuery.region" placeholder="选择省市" width="200px" @change="searchPoi" />
        <el-switch v-model="poiQuery.cityLimit" active-text="仅限本市" />
        <el-button type="primary" :loading="poiLoading" @click="searchPoi">搜索</el-button>
      </div>

      <RequestError :message="poiFailure" :loading="poiLoading" @retry="searchPoi"/>
      <div v-if="!poiFailure" v-loading="poiLoading" class="poi-area">
        <el-empty
          v-if="!poiLoading && poiList.length === 0"
          :description="poiSearched ? '没有找到相关地点，换个关键词试试' : '输入关键词与城市，查询高德实时地点'"
        />

        <div v-else class="poi-grid">
          <div v-for="(poi, index) in poiList" :key="`${poi.name}-${index}`" class="poi-card">
            <div class="poi-card__head">
              <h3 class="poi-card__name" :title="poi.name">{{ poi.name }}</h3>
              <el-tag v-if="poi.type" class="poi-card__category" :title="poi.type" size="small" effect="plain" type="info">{{ poiCategory(poi.type) }}</el-tag>
            </div>
            <p class="poi-card__addr">
              <el-icon><Location /></el-icon>
              {{ poi.address || '地址未提供' }}
            </p>
            <p class="poi-card__meta">
              <span>{{ poi.city || '—' }}{{ poi.district ? ' · ' + poi.district : '' }}</span>
              <span v-if="poi.longitude !== null && poi.latitude !== null" class="coord">
                {{ poi.longitude }}, {{ poi.latitude }}
              </span>
            </p>
            <el-button size="small" plain type="primary" @click="createFromPoi(poi)">
              录入景点
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 本地自建景点 -->
    <div class="tp-card tp-card__body">
      <div class="section-head">
        <div>
          <h2 class="section-title">本地自建景点</h2>
          <p class="section-desc">可收藏、可在每日行程中引用；只有创建者可以编辑或删除。</p>
        </div>
        <span class="tp-muted">共 {{ attractionTotal }} 个</span>
      </div>

      <div class="tp-toolbar">
        <el-input
          v-model.trim="attrQuery.keyword"
          placeholder="搜索景点名称"
          clearable
          style="width: 220px"
          :prefix-icon="Search"
          @keyup.enter="handleAttrSearch"
          @clear="handleAttrSearch"
        />
        <CityCascader v-model="attrQuery.city" placeholder="按省市筛选" width="200px" @change="handleAttrSearch" />
        <el-switch v-model="attrQuery.mineOnly" active-text="只看我创建的" @change="handleAttrSearch" />
        <el-button @click="handleAttrSearch">查询</el-button>
        <el-button text @click="resetAttrQuery">重置</el-button>
        <div class="tp-toolbar__spacer"></div>
        <el-button :icon="Refresh" text @click="loadAttractions">刷新</el-button>
      </div>

      <RequestError :message="attrFailure" :loading="attrLoading" @retry="loadAttractions"/>
      <el-table v-if="!attrFailure" v-loading="attrLoading" :data="attractions" stripe row-key="attractionId">
        <el-table-column prop="name" label="景点名称" min-width="200" show-overflow-tooltip/>
        <el-table-column prop="city" label="城市" min-width="120" show-overflow-tooltip/>
        <el-table-column prop="category" label="分类" min-width="120" show-overflow-tooltip/>
        <el-table-column label="建议游玩" width="144" align="right"><template #default="{row}">{{durationText(row.suggestedDurationMinutes)}}</template></el-table-column>
        <el-table-column label="参考门票" width="128" align="right"><template #default="{row}">{{row.referenceTicketPrice===null?'未填写':money(row.referenceTicketPrice)}}</template></el-table-column>
        <el-table-column prop="description" label="描述" min-width="200" show-overflow-tooltip/>
        <el-table-column label="操作" width="88" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openDetail(row)">详情</el-button></template></el-table-column>
        <template #empty><el-empty :description="attrQuery.keyword||attrQuery.city||attrQuery.mineOnly?'没有匹配的记录，请调整或清空检索条件':'暂无本地景点，搜索录入或新增一个吧'"><el-button @click="resetAttrQuery">清空条件</el-button></el-empty></template>
      </el-table>
      <ListPagination v-if="!attrFailure" :page="attrQuery.page" :total="attractionTotal" @change="page=>{attrQuery.page=page;loadAttractions()}"/>
    </div>

    <AttractionFormDialog v-model="formVisible" :attraction="editingAttraction" :prefill="poiSeed" @saved="handleSaved" />
    <AttractionDetailDialog v-model="detailVisible" :attraction="detailAttraction" :default-trip-id="contextTrip?.tripId" @changed="loadAttractions" />
    <AddToTripDialog v-model="addVisible" :attraction="addingAttraction" :default-trip-id="contextTrip?.tripId" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import ListPagination from '@/components/common/ListPagination.vue'
import RequestError from '@/components/common/RequestError.vue'
import {errorMessage} from '@/utils/request'
import {useRoute,useRouter} from 'vue-router'
import {tripApi} from '@/api/trip'
import type {Trip} from '@/types/api'
import AddToTripDialog from '@/components/attraction/AddToTripDialog.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Location, Plus, Refresh, Search, Ticket } from '@element-plus/icons-vue'
import { attractionApi } from '@/api/attraction'
import { favoriteApi } from '@/api/favorite'
import { poiApi } from '@/api/poi'
import CityCascader from '@/components/common/CityCascader.vue'
import AttractionDetailDialog from '@/components/attraction/AttractionDetailDialog.vue'
import AttractionFormDialog from '@/components/attraction/AttractionFormDialog.vue'
import type { Attraction, AttractionPayload, PoiItem } from '@/types/api'
import { durationText, money } from '@/utils/format'
import { poiCategory, poiPrefill } from '@/utils/poi'

/* ===== 高德实时搜索 ===== */
const poiQuery = reactive({ keywords: '', region: '', cityLimit: true })
const poiList = ref<PoiItem[]>([])
const poiLoading = ref(false)
const poiSearched = ref(false)
const poiFailure=ref('')

async function searchPoi() {
  if (!poiQuery.keywords) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  if (!poiQuery.region) {
    ElMessage.warning('请输入城市名称')
    return
  }
  poiLoading.value = true
  poiFailure.value=''
  try {
    const result = await poiApi.search({
      keywords: poiQuery.keywords,
      region: poiQuery.region,
      cityLimit: poiQuery.cityLimit,
      page: 1,
      size: 10
    })
    poiList.value = result.list || []
    poiSearched.value = true
  } catch(e) {
    poiFailure.value=errorMessage(e)
  } finally {
    poiLoading.value = false
  }
}

function createFromPoi(poi: PoiItem) {
  editingAttraction.value = null
  poiSeed.value = poiPrefill(poi)
  formVisible.value = true
}

/* ===== 本地景点 ===== */
const attractions = ref<Attraction[]>([])
const attractionTotal = ref(0)
const attrLoading = ref(false)
const attrFailure=ref('');let attrSequence=0
const formVisible = ref(false)
const editingAttraction = ref<Attraction | null>(null)
const poiSeed = ref<Partial<AttractionPayload> | null>(null)
const detailVisible = ref(false)
const detailAttraction = ref<Attraction | null>(null)
const favoriteLoadingId = ref('')

const attrQuery = reactive({
  page: 1,
  size: 20,
  keyword: '',
  city: '',
  mineOnly: false
})

async function loadAttractions() {
  const run=++attrSequence
  attrLoading.value = true
  attrFailure.value=''
  try {
    const result = await attractionApi.list({
      page: attrQuery.page,
      size: attrQuery.size,
      keyword: attrQuery.keyword,
      city: attrQuery.city,
      mineOnly: attrQuery.mineOnly
    })
    if(run!==attrSequence)return
    attractions.value = result.list
    attractionTotal.value = result.total
  } catch(e) {
    if(run===attrSequence)attrFailure.value=errorMessage(e)
  } finally {
    if(run===attrSequence)attrLoading.value = false
  }
}

function handleAttrSearch() {
  attrQuery.page = 1
  loadAttractions()
}

function resetAttrQuery() {
  attrQuery.keyword = ''
  attrQuery.city = ''
  attrQuery.mineOnly = false
  handleAttrSearch()
}

function handleAttrSizeChange() {
  attrQuery.page = 1
  loadAttractions()
}

function openCreate() {
  editingAttraction.value = null
  poiSeed.value = null
  formVisible.value = true
}

function openEdit(item: Attraction) {
  editingAttraction.value = item
  poiSeed.value = null
  formVisible.value = true
}

function openDetail(item: Attraction) {
  detailAttraction.value = item
  detailVisible.value = true
}

function handleSaved(saved:Attraction) {
  attrQuery.page = 1
  loadAttractions()
  if(!editingAttraction.value){recentAttraction.value=saved;openDetail(saved)}
}


onMounted(loadAttractions)
const route=useRoute(),router=useRouter(),contextTrip=ref<Trip|null>(null)
const addVisible=ref(false),addingAttraction=ref<Attraction|null>(null)
const recentAttraction=ref<Attraction|null>(null)
function addToTrip(attraction:Attraction){addingAttraction.value=attraction;addVisible.value=true}
onMounted(async()=>{if(route.query.tripId){try{contextTrip.value=await tripApi.detail(String(route.query.tripId));poiQuery.region=contextTrip.value.destination;attrQuery.city=contextTrip.value.destination;loadAttractions()}catch{/* keep standalone exploration available */}}})
</script>

<style scoped>
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap:12px;
  margin-bottom:12px;
  flex-wrap: wrap;
}

.section-title {
  margin:0 0 4px;
  font-size: var(--tp-font-section);
  font-weight: 600;
}

.section-desc {
  margin:0;
  font-size: var(--tp-font-title);
  color: var(--tp-text-secondary);
}

.poi-area {
  min-height: 80px;
}

.poi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap:12px;
}

.poi-card {
  min-width: 0;
  border: 1px solid var(--tp-border);
  border-radius: 10px;
  padding:12px;
  background: #fbfcff;
  display: flex;
  flex-direction: column;
  gap:8px;
}

.poi-card__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap:8px;
}

.poi-card__name {
  width: 100%;
  min-width: 0;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin:0;
  font-size: var(--tp-font-body);
  font-weight: 600;
  line-height: 1.4;
}

.poi-card__category { max-width: 100%; }
.poi-card__category :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-card__addr {
  margin:0;
  font-size: var(--tp-font-title);
  color: var(--tp-text-secondary);
  display: flex;
  gap:4px;
  line-height: 1.6;
}

.poi-card__meta {
  margin:0;
  font-size: var(--tp-font-title);
  color:var(--tp-text-secondary);
  display: flex;
  justify-content: space-between;
  gap:8px;
  flex-wrap: wrap;
}

.coord {
  font-variant-numeric: tabular-nums;
}

.poi-card .el-button {
  align-self: flex-start;
}

.attr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap:12px;
}

.attr-card {
  border: 1px solid var(--tp-border);
  border-radius: 12px;
  padding:16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap:8px;
  transition: box-shadow 0.2s, transform 0.2s;
}

.attr-card:hover {
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.08);
  transform: translateY(-2px);
}

.attr-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap:8px;
}

.attr-card__name {
  margin:0;
  font-size: var(--tp-font-section);
  font-weight: 600;
  cursor: pointer;
  line-height: 1.4;
}

.attr-card__name:hover {
  color: var(--tp-primary);
}

.attr-card__tags {
  display: flex;
  gap:4px;
  flex-wrap: wrap;
}

.attr-card__desc {
  margin:0;
  font-size: var(--tp-font-title);
  color: var(--tp-text-secondary);
  line-height: 1.7;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 40px;
}

.attr-card__meta {
  display: flex;
  gap:16px;
  font-size: var(--tp-font-title);
  color: var(--tp-text-secondary);
}

.attr-card__meta span {
  display: inline-flex;
  align-items: center;
  gap:4px;
}

.attr-card__actions {
  display: flex;
  align-items: center;
  gap:4px;
  border-top: 1px dashed var(--tp-border);
  padding-top:8px;
  margin-top:auto;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top:16px;
}
</style>
