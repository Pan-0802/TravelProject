<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="layout__aside">
      <div class="layout__logo" :class="{ 'layout__logo--mini': collapsed }">
        <el-icon :size="22"><MapLocation /></el-icon>
        <span v-show="!collapsed">Travel Planner</span>
      </div>

      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        :collapse-transition="false"
        router
        class="layout__menu"
        background-color="#1f2a44"
        text-color="#c6cfe0"
        active-text-color="#ffffff"
      >
        <el-menu-item v-for="item in menus" :key="item.path" :index="item.path">
          <el-icon><component :is="item.icon" /></el-icon>
          <template #title>{{ item.title }}</template>
        </el-menu-item>
      </el-menu>

      <div class="layout__aside-foot" v-show="!collapsed">
        <p>数据库课程设计</p>
        <p>V1.0 · 前端</p>
      </div>
    </el-aside>

    <el-container>
      <el-header class="layout__header">
        <div class="layout__header-left">
          <el-button text class="layout__collapse" @click="collapsed = !collapsed">
            <el-icon :size="18"><component :is="collapsed ? 'Expand' : 'Fold'" /></el-icon>
          </el-button>
          <span class="layout__page-title">{{ pageTitle }}</span>
          <el-tag v-if="isMock" type="warning" effect="plain" size="small" class="layout__mock-tag">
            Mock 演示模式
          </el-tag>
        </div>

        <div class="layout__header-right">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="layout__user">
              <el-avatar :size="30" class="layout__avatar">{{ auth.avatarText }}</el-avatar>
              <span class="layout__username">{{ auth.displayName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon> 个人中心
                </el-dropdown-item>
                <el-dropdown-item command="logout" divided>
                  <el-icon><SwitchButton /></el-icon> 退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="layout__main">
        <router-view v-slot="{ Component }">
          <transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const compactViewport = window.matchMedia('(max-width: 959px)')
const collapsed = ref(compactViewport.matches)
function updateViewport(event: MediaQueryListEvent) { if (event.matches) collapsed.value = true }
const isMock = import.meta.env.VITE_USE_MOCK === 'true'

const menus = [
  { path: '/trips', title: '旅行计划', icon: 'Suitcase' },
  { path: '/attractions', title: '景点探索', icon: 'Location' },
  { path: '/favorites', title: '我的收藏', icon: 'Star' },
  { path: '/ai', title: 'AI 智能规划', icon: 'MagicStick' },
  { path: '/statistics', title: '数据统计', icon: 'DataAnalysis' },
  { path: '/profile', title: '个人中心', icon: 'User' }
]

const activeMenu = computed(() => (route.meta.activeMenu as string) || route.path)
const pageTitle = computed(() => (route.meta.title as string) || '旅行规划')

async function handleCommand(command: string) {
  if (command === 'profile') {
    router.push('/profile')
    return
  }
  if (command === 'logout') {
    try {
      await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
        confirmButtonText: '退出',
        cancelButtonText: '取消',
        type: 'warning'
      })
    } catch {
      return
    }
    await auth.logout()
    router.replace('/auth/login')
  }
}

onMounted(() => {
  compactViewport.addEventListener('change', updateViewport)
  // 刷新页面后同步一次最新用户资料，失败静默（拦截器会处理 401）
  auth.refreshMe().catch(() => undefined)
})
onBeforeUnmount(() => compactViewport.removeEventListener('change', updateViewport))
</script>

<style scoped>
.layout {
  min-height: 100vh;
}

.layout__aside {
  background: #1f2a44;
  color:#ffffff;
  transition: width 0.2s ease;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 0;
  height: 100vh;
}

.layout__logo {
  height: 60px;
  display: flex;
  align-items: center;
  gap:8px;
  padding:0 16px;
  font-size: var(--tp-font-section);
  font-weight: 600;
  color:#ffffff;
  letter-spacing: 0.3px;
  white-space: nowrap;
  overflow: hidden;
}

.layout__logo--mini {
  justify-content: center;
  padding:0;
}

.layout__menu {
  border-right: none;
  flex: 1;
}

.layout__menu :deep(.el-menu-item.is-active) {
  background: linear-gradient(90deg, #3f7ef7, #2f5fd0);
}

.layout__menu :deep(.el-menu-item:hover) {
  background-color: #2a3654;
}

.layout__aside-foot {
  padding:12px 16px;
  font-size: var(--tp-font-body);
  line-height: 1.7;
  color:var(--tp-text-secondary);
}

.layout__aside-foot p {
  margin:0;
}

.layout__header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-bottom: 1px solid var(--tp-border);
  padding:0 16px 0 8px;
  position: sticky;
  top: 0;
  z-index: 10;
}

.layout__header-left {
  display: flex;
  align-items: center;
  gap:8px;
}

.layout__collapse {
  color:var(--tp-primary);
}

.layout__page-title {
  font-size: var(--tp-font-section);
  font-weight: 600;
}

.layout__mock-tag {
  margin-left:4px;
}

.layout__user {
  display: flex;
  align-items: center;
  gap:8px;
  cursor: pointer;
  padding:4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.layout__user:hover {
  background: #f2f5fb;
}

.layout__avatar {
  background: var(--tp-primary);
  color:#ffffff;
  font-weight: 600;
}

.layout__username {
  font-size: var(--tp-font-body);
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.layout__main {
  padding:0;
  background: var(--tp-bg);
  overflow-x: hidden;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .layout__username {
    display: none;
  }
}
</style>
