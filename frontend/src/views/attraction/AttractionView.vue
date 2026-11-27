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
    <div class="tp-card tp-card__body poi-search">
      <div class="section-head">
        <div>
          <h2 class="section-title">高德实时搜索</h2>
          <p class="section-desc">点击结果可预填名称、城市和分类，核对后保存为本地景点。</p>
        </div>
        <el-tag type="info" effect="plain">实时查询 · 确认后录入</el-tag>
      </div>

      <div class="tp-toolbar poi-search__toolbar">
        <el-input
          v-model.trim="poiQuery.keywords"
          placeholder="关键词，如：博物馆"
          clearable
          maxlength="80"
          class="poi-search__keywords"
          :prefix-icon="Search"
          @keyup.enter="searchPoi"
        />
        <CityCascader v-model="poiQuery.region" class="poi-search__city" placeholder="选择省市" width="200px" @change="searchPoi" />
        <el-switch v-model="poiQuery.cityLimit" active-text="仅限本市" />
        <el-button type="primary" :loading="poiLoading" @click="searchPoi">搜索</el-button>
      </div>

      <RequestError :message="poiFailure" :loading="poiLoading" @retry="searchPoi"/>
      <div v-if="!poiFailure" v-loading="poiLoading" class="poi-area">
        <el-empty
          v-if="!poiLoading && poiList.length === 0"
          :description="poiSearched ? '没有找到相关地点，换个关键词试试' : '输入关键词与城市，查询高德实时地点'"
        />

        <template v-else-if="poiList.length">
        <div class="poi-results-summary">
          <span>找到 <strong>{{ poiList.length }}</strong> 个地点</span>
          <span>选择地点，确认后录入</span>
        </div>
        <div class="poi-grid">
          <article v-for="(poi, index) in poiList" :key="`${poi.name}-${index}`" class="poi-card">
            <div class="poi-card__head">
              <h3 class="poi-card__name" :title="poi.name">{{ poi.name }}</h3>
              <el-tag v-if="poi.type" class="poi-card__category" :title="poi.type" size="small" effect="light">{{ poiCategory(poi.type) }}</el-tag>
            </div>
            <p class="poi-card__meta">
              <el-icon><Location /></el-icon>
              <span :title="[poi.city, poi.district].filter(Boolean).join(' · ')">{{ poi.city || '城市未提供' }}{{ poi.district ? ' · ' + poi.district : '' }}</span>
            </p>
            <p class="poi-card__addr">
              <span :title="poi.address || undefined">{{ poi.address || '地址未提供' }}</span>
            </p>
            <div class="poi-card__footer">
              <el-tooltip v-if="poi.longitude != null && poi.latitude != null" :content="`经纬度：${poi.longitude}, ${poi.latitude}`" :trigger="['hover', 'focus', 'click']" :disabled="formVisible" placement="top">
                <button type="button" class="poi-card__coordinates" :aria-label="`查看${poi.name}的经纬度`">查看坐标</button>
              </el-tooltip>
              <el-button size="small" plain type="primary" :icon="Plus" @click="createFromPoi(poi)">
                录入景点
              </el-button>
            </div>
          </article>
        </div>
        </template>
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

      <div class="tp-toolbar attraction-filters">
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
      <el-table v-if="!attrFailure" v-loading="attrLoading" :data="attractions" class="attraction-table" stripe row-key="attractionId">
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
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
  line-height: 1.6;
}

.poi-search__toolbar {
  flex-wrap: wrap;
  overflow-x: visible;
  padding: 16px;
  background: #f5f8ff;
  border: 1px solid #e8eefb;
  border-radius: 8px;
  gap: 12px;
}

.poi-search__keywords {
  width: 300px;
  max-width: 100%;
}

.poi-search__keywords,
.poi-search__toolbar :deep(.el-cascader),
.poi-search__toolbar .el-switch {
  flex-shrink: 0;
}

.poi-area {
  min-height: 80px;
}

.poi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 16px;
}

.poi-results-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0 0 12px;
  color: var(--tp-text-secondary);
  font-size: var(--tp-font-body);
}

.poi-results-summary strong {
  color: var(--tp-primary);
  font-weight: 600;
}

.poi-card {
  min-width: 0;
  border: 1px solid #e2e8f2;
  border-radius: 10px;
  padding: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.poi-card:hover,
.poi-card:focus-within {
  border-color: #b3cbfb;
  box-shadow: 0 4px 16px rgba(63, 126, 247, 0.08);
}

.poi-card__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
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
  font-size: var(--tp-font-section);
  font-weight: 600;
  color: #25334d;
  line-height: 1.5;
}

.poi-card__category { max-width: 100%; }
.poi-card__category :deep(.el-tag__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-card__addr {
  margin: 0;
  min-height: 44px;
  font-size: var(--tp-font-body);
  color: var(--tp-text-secondary);
  line-height: 1.6;
}

.poi-card__addr span {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}

.poi-card__meta {
  margin: 4px 0 0;
  font-size: var(--tp-font-body);
  color: #61708a;
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  line-height: 1.6;
}

.poi-card__meta .el-icon {
  flex-shrink: 0;
  color: var(--tp-primary);
}

.poi-card__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.poi-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid #eef2f8;
  padding-top: 12px;
  margin-top: auto;
}

.poi-card__footer .el-button {
  margin-left: auto;
  min-height: 32px;
}

.poi-card__coordinates {
  border: 0;
  background: none;
  padding: 4px 0;
  color: #61708a;
  font: inherit;
  font-size: var(--tp-font-body);
  cursor: pointer;
}

.poi-card__coordinates:hover {
  color: var(--tp-primary);
}

.poi-card__coordinates:focus-visible {
  outline: 2px solid var(--tp-primary);
  outline-offset: 4px;
  border-radius: 4px;
}

.attraction-table :deep(.el-table__empty-text) {
  width: 100%;
  line-height: 1.6;
}

@media (max-width: 600px) {
  .poi-search__toolbar {
    padding: 12px;
  }

  .poi-search__keywords,
  .poi-search__toolbar :deep(.el-cascader),
  .attraction-filters > .el-input,
  .attraction-filters :deep(.el-cascader) {
    width: 100% !important;
    flex-shrink: 0;
  }

  .attraction-filters {
    flex-wrap: wrap;
    overflow-x: visible;
  }

  .attraction-filters .el-switch {
    flex-shrink: 0;
  }

  .poi-results-summary > span:last-child {
    display: none;
  }

  .poi-search > .section-head > .el-tag {
    display: none;
  }
}
</style>
