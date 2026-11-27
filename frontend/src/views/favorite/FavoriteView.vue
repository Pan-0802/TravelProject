<template>
  <div class="page">
    <div class="page-header"><div><h1 class="page-title">我的收藏</h1><p class="page-subtitle">查看景点详情，再选择加入旅行或取消收藏。</p></div><el-button @click="router.push('/attractions')">去景点探索</el-button></div>
    <div class="tp-card tp-card__body">
      <div class="tp-toolbar"><el-input v-model.trim="query.keyword" placeholder="搜索收藏景点" class="search-input" clearable :prefix-icon="Search" @keyup.enter="search" @clear="search"/><CitySelect v-model="query.city" placeholder="按城市筛选" width="180px" @change="search"/><el-button @click="search">查询</el-button><el-button text @click="reset">重置</el-button><div class="tp-toolbar__spacer"/><el-button :icon="Refresh" text @click="loadFavorites">刷新</el-button></div>
      <RequestError :message="failure" :loading="loading" @retry="loadFavorites"/>
      <el-table max-height="calc(100dvh - 320px)" v-if="!failure" v-loading="loading" :data="favorites" stripe row-key="favoriteId">
        <el-table-column prop="attraction.name" label="景点名称" min-width="200" show-overflow-tooltip/><el-table-column prop="attraction.city" label="城市" min-width="120" show-overflow-tooltip/>
        <el-table-column prop="attraction.category" label="分类" min-width="120" show-overflow-tooltip/>
        <el-table-column label="参考门票" width="128" align="right"><template #default="{row}">{{row.attraction.referenceTicketPrice===null?'未填写':money(row.attraction.referenceTicketPrice)}}</template></el-table-column>
        <el-table-column label="收藏时间" width="184" align="right"><template #default="{row}">{{dateTime(row.createdAt)}}</template></el-table-column>
        <el-table-column label="操作" width="88" fixed="right"><template #default="{row}"><el-button link type="primary" @click="openDetail(row.attraction)">详情</el-button></template></el-table-column>
        <template #empty><el-empty :description="query.keyword||query.city?'没有匹配的记录，请调整或清空检索条件':'还没有收藏任何景点，去景点探索收藏几个吧'"><el-button v-if="query.keyword||query.city" @click="reset">清空条件</el-button><el-button v-else type="primary" @click="router.push('/attractions')">去收藏</el-button></el-empty></template>
      </el-table>
      <ListPagination v-if="!failure" :page="query.page" :total="total" @change="changePage"/>
    </div>
    <AttractionDetailDialog v-model="detailVisible" :attraction="detailAttraction" @changed="loadFavorites"/>
  </div>
</template>
<script setup lang="ts">
import {onMounted,reactive,ref} from 'vue'
import {useRouter} from 'vue-router'
import {Search,Refresh} from '@element-plus/icons-vue'
import {favoriteApi} from '@/api/favorite'
import CitySelect from '@/components/common/CitySelect.vue'
import ListPagination from '@/components/common/ListPagination.vue'
import RequestError from '@/components/common/RequestError.vue'
import AttractionDetailDialog from '@/components/attraction/AttractionDetailDialog.vue'
import type {Attraction,FavoriteItem} from '@/types/api'
import {dateTime,money} from '@/utils/format'
import {errorMessage} from '@/utils/request'
const router=useRouter(),favorites=ref<FavoriteItem[]>([]),total=ref(0),loading=ref(false),failure=ref(''),detailVisible=ref(false),detailAttraction=ref<Attraction|null>(null)
const query=reactive({page:1,size:20,keyword:'',city:''});let sequence=0
async function loadFavorites(){const run=++sequence;loading.value=true;failure.value='';try{const result=await favoriteApi.list({...query});if(run===sequence){favorites.value=result.list;total.value=result.total}}catch(e){if(run===sequence)failure.value=errorMessage(e)}finally{if(run===sequence)loading.value=false}}
function search(){query.page=1;loadFavorites()}
function reset(){query.keyword='';query.city='';search()}
function changePage(page:number){query.page=page;loadFavorites()}
function openDetail(a:Attraction){detailAttraction.value={...a,isFavorited:true};detailVisible.value=true}
onMounted(loadFavorites)
</script>
