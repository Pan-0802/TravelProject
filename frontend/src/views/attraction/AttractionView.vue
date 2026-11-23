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
        <el-input
          v-model.trim="poiQuery.region"
          placeholder="城市，如：重庆市"
          clearable
          style="width: 180px"
          @keyup.enter="searchPoi"
        />
        <el-switch v-model="poiQuery.cityLimit" active-text="仅限本市" />
        <el-button type="primary" :loading="poiLoading" @click="searchPoi">搜索</el-button>
      </div>

      <div v-loading="poiLoading" class="poi-area">
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
        <el-input
          v-model.trim="attrQuery.city"
          placeholder="按城市筛选"
          clearable
          style="width: 160px"
          @keyup.enter="handleAttrSearch"
          @clear="handleAttrSearch"
        />
        <el-switch v-model="attrQuery.mineOnly" active-text="只看我创建的" @change="handleAttrSearch" />
        <el-button @click="handleAttrSearch">查询</el-button>
        <el-button text @click="resetAttrQuery">重置</el-button>
        <div class="tp-toolbar__spacer"></div>
        <el-button :icon="Refresh" text @click="loadAttractions">刷新</el-button>
      </div>

      <div v-loading="attrLoading">
        <el-empty
          v-if="!attrLoading && attractions.length === 0"
          description="还没有本地景点，点击右上角“新增自建景点”创建"
        />

        <div v-else class="attr-grid">
          <div v-for="item in attractions" :key="item.attractionId" class="attr-card">
            <div class="attr-card__head">
              <h3 class="attr-card__name" @click="openDetail(item)">{{ item.name }}</h3>
              <el-tag v-if="item.isOwner" size="small" effect="plain" type="success">我创建的</el-tag>
            </div>

            <div class="attr-card__tags">
              <el-tag size="small" effect="plain">{{ item.city }}</el-tag>
              <el-tag v-if="item.category" size="small" effect="plain" type="info">{{ item.category }}</el-tag>
            </div>

            <p class="attr-card__desc">{{ item.description || '暂无描述' }}</p>

            <div class="attr-card__meta">
              <span><el-icon><Clock /></el-icon>{{ durationText(item.suggestedDurationMinutes) }}</span>
              <span><el-icon><Ticket /></el-icon>{{ item.referenceTicketPrice === null ? '未填' : money(item.referenceTicketPrice) }}</span>
            </div>

            <div class="attr-card__actions">
              <el-button size="small" text type="primary" @click="openDetail(item)">详情</el-button>
              <el-button
                size="small"
                text
                :type="item.isFavorited ? 'warning' : 'primary'"
                :loading="favoriteLoadingId === item.attractionId"
                @click="toggleFavorite(item)"
              >
                {{ item.isFavorited ? '取消收藏' : '收藏' }}
              </el-button>
              <template v-if="item.isOwner">
                <el-button size="small" text @click="openEdit(item)">编辑</el-button>
                <el-button size="small" text type="danger" @click="removeAttraction(item)">删除</el-button>
              </template>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination">
        <el-pagination
          v-model:current-page="attrQuery.page"
          v-model:page-size="attrQuery.size"
          :total="attractionTotal"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadAttractions"
          @size-change="handleAttrSizeChange"
        />
      </div>
    </div>

    <AttractionFormDialog v-model="formVisible" :attraction="editingAttraction" :prefill="poiSeed" @saved="handleSaved" />
    <AttractionDetailDialog v-model="detailVisible" :attraction="detailAttraction" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Location, Plus, Refresh, Search, Ticket } from '@element-plus/icons-vue'
import { attractionApi } from '@/api/attraction'
import { favoriteApi } from '@/api/favorite'
import { poiApi } from '@/api/poi'
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
  } catch {
    poiList.value = []
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
const formVisible = ref(false)
const editingAttraction = ref<Attraction | null>(null)
const poiSeed = ref<Partial<AttractionPayload> | null>(null)
const detailVisible = ref(false)
const detailAttraction = ref<Attraction | null>(null)
const favoriteLoadingId = ref('')

const attrQuery = reactive({
  page: 1,
  size: 12,
  keyword: '',
  city: '',
  mineOnly: false
})

async function loadAttractions() {
  attrLoading.value = true
  try {
    const result = await attractionApi.list({
      page: attrQuery.page,
      size: attrQuery.size,
      keyword: attrQuery.keyword,
      city: attrQuery.city,
      mineOnly: attrQuery.mineOnly
    })
    attractions.value = result.list
    attractionTotal.value = result.total
  } catch {
    attractions.value = []
    attractionTotal.value = 0
  } finally {
    attrLoading.value = false
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

function handleSaved() {
  attrQuery.page = 1
  loadAttractions()
}

async function toggleFavorite(item: Attraction) {
  favoriteLoadingId.value = item.attractionId
  try {
    if (item.isFavorited) {
      await favoriteApi.remove(item.attractionId)
      item.isFavorited = false
      ElMessage.success('已取消收藏')
    } else {
      await favoriteApi.add(item.attractionId)
      item.isFavorited = true
      ElMessage.success('收藏成功')
    }
  } catch {
    // 409（重复收藏）等情况下刷新列表，保证状态与后端一致
    loadAttractions()
  } finally {
    favoriteLoadingId.value = ''
  }
}

async function removeAttraction(item: Attraction) {
  try {
    await ElMessageBox.confirm(
      `删除「${item.name}」后，相关收藏会被一并删除；已有行程中的活动名称会保留，但不再关联该景点。确定删除吗？`,
      '删除景点',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    return
  }
  try {
    await attractionApi.remove(item.attractionId)
    ElMessage.success('景点已删除')
    if (attractions.value.length === 1 && attrQuery.page > 1) attrQuery.page -= 1
    loadAttractions()
  } catch {
    // 403/404 由拦截器提示
  }
}

onMounted(loadAttractions)
</script>

<style scoped>
.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}

.section-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.section-desc {
  margin: 0;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.poi-area {
  min-height: 80px;
}

.poi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.poi-card {
  min-width: 0;
  border: 1px solid var(--tp-border);
  border-radius: 10px;
  padding: 14px;
  background: #fbfcff;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.poi-card__head {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
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
  margin: 0;
  font-size: 15px;
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
  margin: 0;
  font-size: 12px;
  color: var(--tp-text-secondary);
  display: flex;
  gap: 4px;
  line-height: 1.6;
}

.poi-card__meta {
  margin: 0;
  font-size: 12px;
  color: #8b98ac;
  display: flex;
  justify-content: space-between;
  gap: 8px;
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
  gap: 14px;
}

.attr-card {
  border: 1px solid var(--tp-border);
  border-radius: 12px;
  padding: 16px;
  background: #fff;
  display: flex;
  flex-direction: column;
  gap: 10px;
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
  gap: 8px;
}

.attr-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.4;
}

.attr-card__name:hover {
  color: var(--tp-primary);
}

.attr-card__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.attr-card__desc {
  margin: 0;
  font-size: 12px;
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
  gap: 16px;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.attr-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.attr-card__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  border-top: 1px dashed var(--tp-border);
  padding-top: 8px;
  margin-top: auto;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
