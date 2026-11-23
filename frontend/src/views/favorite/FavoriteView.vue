<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h1 class="page-title">我的收藏</h1>
        <p class="page-subtitle">收藏的本地自建景点，可随时加入行程安排。共 {{ total }} 个。</p>
      </div>
      <el-button :icon="Location" @click="router.push('/attractions')">去景点探索</el-button>
    </div>

    <div class="tp-card tp-card__body">
      <div class="tp-toolbar">
        <el-input
          v-model.trim="query.keyword"
          placeholder="搜索收藏景点"
          clearable
          style="width: 220px"
          :prefix-icon="Search"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <CitySelect v-model="query.city" placeholder="按城市筛选" width="180px" @change="handleSearch" />
        <el-button @click="handleSearch">查询</el-button>
        <el-button text @click="handleReset">重置</el-button>
        <div class="tp-toolbar__spacer"></div>
        <el-button :icon="Refresh" text @click="loadFavorites">刷新</el-button>
      </div>

      <div v-loading="loading">
        <el-empty
          v-if="!loading && favorites.length === 0"
          description="还没有收藏任何景点，去“景点探索”收藏几个吧"
        >
          <el-button type="primary" @click="router.push('/attractions')">去收藏</el-button>
        </el-empty>

        <div v-else class="fav-grid">
          <div v-for="fav in favorites" :key="fav.favoriteId" class="fav-card">
            <div class="fav-card__head">
              <h3 class="fav-card__name" @click="openDetail(fav.attraction)">{{ fav.attraction.name }}</h3>
              <el-tag v-if="fav.attraction.isOwner" size="small" effect="plain" type="success">我创建的</el-tag>
            </div>

            <div class="fav-card__tags">
              <el-tag size="small" effect="plain">{{ fav.attraction.city }}</el-tag>
              <el-tag v-if="fav.attraction.category" size="small" effect="plain" type="info">
                {{ fav.attraction.category }}
              </el-tag>
            </div>

            <p class="fav-card__desc">{{ fav.attraction.description || '暂无描述' }}</p>

            <div class="fav-card__meta">
              <span><el-icon><Clock /></el-icon>{{ durationText(fav.attraction.suggestedDurationMinutes) }}</span>
              <span>
                <el-icon><Ticket /></el-icon>
                {{ fav.attraction.referenceTicketPrice === null ? '未填' : money(fav.attraction.referenceTicketPrice) }}
              </span>
            </div>

            <div class="fav-card__footer">
              <span class="tp-muted">收藏于 {{ dateTime(fav.createdAt) }}</span>
              <el-button size="small" text type="warning" @click="removeFavorite(fav)">取消收藏</el-button>
            </div>
          </div>
        </div>
      </div>

      <div class="pagination" v-if="total > 0">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.size"
          :total="total"
          :page-sizes="[12, 24, 48]"
          layout="total, sizes, prev, pager, next"
          background
          @current-change="loadFavorites"
          @size-change="handleSearch"
        />
      </div>
    </div>

    <AttractionDetailDialog v-model="detailVisible" :attraction="detailAttraction" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Clock, Location, Refresh, Search, Ticket } from '@element-plus/icons-vue'
import { favoriteApi } from '@/api/favorite'
import CitySelect from '@/components/common/CitySelect.vue'
import AttractionDetailDialog from '@/components/attraction/AttractionDetailDialog.vue'
import type { Attraction, FavoriteItem } from '@/types/api'
import { dateTime, durationText, money } from '@/utils/format'

const router = useRouter()

const favorites = ref<FavoriteItem[]>([])
const total = ref(0)
const loading = ref(false)
const detailVisible = ref(false)
const detailAttraction = ref<Attraction | null>(null)

const query = reactive({ page: 1, size: 12, keyword: '', city: '' })

async function loadFavorites() {
  loading.value = true
  try {
    const result = await favoriteApi.list({
      page: query.page,
      size: query.size,
      keyword: query.keyword,
      city: query.city
    })
    favorites.value = result.list
    total.value = result.total
  } catch {
    favorites.value = []
    total.value = 0
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  query.page = 1
  loadFavorites()
}

function handleReset() {
  query.keyword = ''
  query.city = ''
  handleSearch()
}

function openDetail(attraction: Attraction) {
  detailAttraction.value = { ...attraction, isFavorited: true }
  detailVisible.value = true
}

async function removeFavorite(fav: FavoriteItem) {
  try {
    await ElMessageBox.confirm(`确定取消收藏「${fav.attraction.name}」吗？`, '取消收藏', {
      type: 'warning',
      confirmButtonText: '取消收藏',
      cancelButtonText: '保留'
    })
  } catch {
    return
  }
  try {
    await favoriteApi.remove(fav.attraction.attractionId)
    ElMessage.success('已取消收藏')
    if (favorites.value.length === 1 && query.page > 1) query.page -= 1
    loadFavorites()
  } catch {
    // 拦截器已提示
  }
}

onMounted(loadFavorites)
</script>

<style scoped>
.fav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.fav-card {
  border: 1px solid var(--tp-border);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: #fff;
  transition: box-shadow 0.2s, transform 0.2s;
}

.fav-card:hover {
  box-shadow: 0 6px 20px rgba(31, 45, 61, 0.08);
  transform: translateY(-2px);
}

.fav-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.fav-card__name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  line-height: 1.4;
}

.fav-card__name:hover {
  color: var(--tp-primary);
}

.fav-card__tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.fav-card__desc {
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

.fav-card__meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--tp-text-secondary);
}

.fav-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.fav-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px dashed var(--tp-border);
  padding-top: 8px;
  margin-top: auto;
  font-size: 12px;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}
</style>
