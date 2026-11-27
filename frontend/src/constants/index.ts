import type {
  AiPlanStatus,
  ExpenseCategory,
  ItinerarySourceType,
  TripStatus
} from '@/types/api'

/** 6 种固定消费类别（与数据库 CHECK 约束一致） */
export const EXPENSE_CATEGORIES: Array<{ value: ExpenseCategory; label: string; color: string }> = [
  { value: 'FOOD', label: '餐饮', color: '#f2a33a' },
  { value: 'TRANSPORT', label: '交通', color: '#3f7ef7' },
  { value: 'HOTEL', label: '住宿', color: '#7c5cf0' },
  { value: 'TICKET', label: '门票', color: '#2bb673' },
  { value: 'SHOPPING', label: '购物', color: '#e6483d' },
  { value: 'OTHER', label: '其他', color: '#8c98a8' }
]

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD: '餐饮',
  TRANSPORT: '交通',
  HOTEL: '住宿',
  TICKET: '门票',
  SHOPPING: '购物',
  OTHER: '其他'
}

export const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  NOT_STARTED: '未开始',
  ONGOING: '进行中',
  FINISHED: '已结束'
}

export const TRIP_STATUS_TAG_TYPE: Record<TripStatus, 'info' | 'success' | 'warning'> = {
  NOT_STARTED: 'info',
  ONGOING: 'info',
  FINISHED: 'info'
}

export const AI_STATUS_LABELS: Record<AiPlanStatus, string> = {
  DRAFT: '草稿',
  SAVED: '已保存',
  FAILED: '生成失败'
}

export const AI_STATUS_TAG_TYPE: Record<AiPlanStatus, 'info' | 'success' | 'danger'> = {
  DRAFT: 'info',
  SAVED: 'success',
  FAILED: 'danger'
}

export const SOURCE_TYPE_LABELS: Record<ItinerarySourceType, string> = {
  MANUAL: '手工',
  AI: 'AI'
}

/** 交通方式下拉选项（自由输入也可） */
export const TRANSPORTATION_OPTIONS = ['步行', '公共交通', '地铁', '公交', '打车', '自驾', '高铁', '飞机', '骑行']

/** AI 规划偏好标签 */
export const PREFERENCE_OPTIONS = [
  '美食',
  '人文',
  '自然风光',
  '轻松',
  '拍照打卡',
  '亲子',
  '购物',
  '夜生活',
  '博物馆',
  '小众路线'
]

/** 全国省市数据统一从 regions.ts 导出（下拉显示「xx省xx市」） */
export { CITY_GROUPS, CITY_OPTIONS, CITY_VALUE_SET, HOT_CITY_OPTIONS, PROVINCE_CITIES } from './regions'
export type { CityGroup, CityOption } from './regions'

/** 通用分页默认值（契约：size 默认 20，最大 50） */
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50
