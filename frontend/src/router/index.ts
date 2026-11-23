import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { getToken } from '@/utils/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/auth',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guestOnly: true },
    children: [
      { path: '', redirect: '/auth/login' },
      {
        path: 'login',
        name: 'Login',
        component: () => import('@/views/auth/LoginView.vue'),
        meta: { title: '登录', guestOnly: true }
      },
      {
        path: 'register',
        name: 'Register',
        component: () => import('@/views/auth/RegisterView.vue'),
        meta: { title: '注册', guestOnly: true }
      }
    ]
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', redirect: '/trips' },
      {
        path: 'trips',
        name: 'TripList',
        component: () => import('@/views/trip/TripListView.vue'),
        meta: { title: '旅行计划', requiresAuth: true }
      },
      {
        path: 'trips/:tripId',
        name: 'TripDetail',
        component: () => import('@/views/trip/TripDetailView.vue'),
        meta: { title: '旅行详情', requiresAuth: true, activeMenu: '/trips' }
      },
      {
        path: 'attractions',
        name: 'Attractions',
        component: () => import('@/views/attraction/AttractionView.vue'),
        meta: { title: '景点探索', requiresAuth: true }
      },
      {
        path: 'favorites',
        name: 'Favorites',
        component: () => import('@/views/favorite/FavoriteView.vue'),
        meta: { title: '我的收藏', requiresAuth: true }
      },
      {
        path: 'ai',
        name: 'AiPlanner',
        component: () => import('@/views/ai/AiPlannerView.vue'),
        meta: { title: 'AI 智能规划', requiresAuth: true }
      },
      {
        path: 'ai/result/:aiPlanId',
        name: 'AiResult',
        component: () => import('@/views/ai/AiResultView.vue'),
        meta: { title: 'AI 方案编辑', requiresAuth: true, activeMenu: '/ai' }
      },
      {
        path: 'statistics',
        name: 'Statistics',
        component: () => import('@/views/statistics/StatisticsView.vue'),
        meta: { title: '数据统计', requiresAuth: true }
      },
      {
        path: 'profile',
        name: 'Profile',
        component: () => import('@/views/profile/ProfileView.vue'),
        meta: { title: '个人中心', requiresAuth: true }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '页面不存在' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

router.beforeEach((to) => {
  const loggedIn = Boolean(getToken())

  if (to.meta.requiresAuth && !loggedIn) {
    return { path: '/auth/login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && loggedIn) {
    return { path: '/trips' }
  }
  return true
})

router.afterEach((to) => {
  const title = (to.meta.title as string) || ''
  document.title = title ? `${title} - 个人旅行记录与智能规划系统` : '个人旅行记录与智能规划系统'
})

export default router
