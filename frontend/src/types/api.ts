/**
 * 与《前后端 API 接口对接文档 V1.0》一一对应的前端类型定义。
 * 约定：主键均为十进制字符串；日期 yyyy-MM-dd；时间 HH:mm；时间戳 yyyy-MM-dd'T'HH:mm:ss。
 */

/** 统一响应包装 */
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

/** 通用分页结构 */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
}

/** 分页查询参数 */
export interface PageQuery {
  page?: number
  size?: number
}

/* ===== 用户 ===== */
export interface User {
  userId: string
  username: string
  nickname: string | null
  createdAt: string
}

export interface LoginResult {
  accessToken: string
  tokenType: string
  expiresIn: number
  user: User
}

export interface RegisterPayload {
  username: string
  password: string
  confirmPassword: string
  nickname?: string
}

export interface RegisterResult {
  userId: string
  username: string
  nickname: string | null
}

/* ===== 旅行 ===== */
export type TripStatus = 'NOT_STARTED' | 'ONGOING' | 'FINISHED'

export interface Trip {
  tripId: string
  title: string
  destination: string
  startDate: string
  endDate: string
  totalBudget: number
  tripStatus: TripStatus
  daysCount: number
  actualExpense: number
  createdAt: string
  updatedAt: string
}

export interface TripQuery extends PageQuery {
  keyword?: string
  status?: TripStatus | ''
}

export interface TripPayload {
  title: string
  destination: string
  startDate: string
  endDate: string
  totalBudget: number
}

/* ===== 景点 ===== */
export interface Attraction {
  attractionId: string
  createdBy: string
  name: string
  city: string
  category: string | null
  description: string | null
  suggestedDurationMinutes: number | null
  referenceTicketPrice: number | null
  /** 仅为显示字段，请求时不可指定 */
  isOwner: boolean
  isFavorited: boolean
}

export interface AttractionQuery extends PageQuery {
  keyword?: string
  city?: string
  mineOnly?: boolean
}

export interface AttractionPayload {
  name: string
  city: string
  category?: string | null
  description?: string | null
  suggestedDurationMinutes?: number | null
  referenceTicketPrice?: number | null
}

/** 高德实时 POI（不落库，ID 不可当 attractionId 使用） */
export interface PoiItem {
  name: string
  address: string | null
  city: string | null
  district: string | null
  type: string | null
  longitude: number | null
  latitude: number | null
}

export interface PoiSearchResult {
  source: 'AMAP_LIVE'
  page: number
  size: number
  list: PoiItem[]
}

/* ===== 收藏 ===== */
export interface FavoriteItem {
  favoriteId: string
  createdAt: string
  attraction: Attraction
}

/** 删除类接口统一返回 */
export interface DeleteResult {
  deleted: boolean
  tripId?: string
}

/* ===== 行程 ===== */
export type ItinerarySourceType = 'MANUAL' | 'AI'

export interface ItineraryItem {
  itemId: string
  dayId: string
  attractionId: string | null
  itemName: string
  startTime: string | null
  endTime: string | null
  sortOrder: number
  transportation: string | null
  estimatedCost: number
  sourceType: ItinerarySourceType
  note: string | null
}

export interface TripDay {
  dayId: string | null
  date: string
  dayNumber: number
  description: string | null
  items: ItineraryItem[]
}

export interface TripDaysResult {
  tripId: string
  startDate: string
  endDate: string
  days: TripDay[]
}

export interface ItineraryItemPayload {
  attractionId?: string | null
  itemName: string
  startTime?: string | null
  endTime?: string | null
  sortOrder?: number
  transportation?: string | null
  estimatedCost?: number
  note?: string | null
}

/* ===== 消费 ===== */
export type ExpenseCategory = 'FOOD' | 'TRANSPORT' | 'HOTEL' | 'TICKET' | 'SHOPPING' | 'OTHER'

export interface Expense {
  expenseId: string
  tripId: string
  category: ExpenseCategory
  amount: number
  spentOn: string
  description: string | null
  createdAt: string
}

export interface ExpenseQuery extends PageQuery {
  category?: ExpenseCategory | ''
  startDate?: string
  endDate?: string
}

export interface ExpensePayload {
  category: ExpenseCategory
  amount: number
  spentOn: string
  description?: string | null
}

export interface CategoryTotal {
  category: ExpenseCategory
  amount: number
}

export interface BudgetSummary {
  tripId: string
  totalBudget: number
  actualExpense: number
  remainingBudget: number
  overBudget: boolean
  categoryTotals: CategoryTotal[]
}

/* ===== AI 规划 ===== */
export type AiPlanStatus = 'DRAFT' | 'SAVED' | 'FAILED'

export interface AiPlanItem {
  itemName: string
  startTime: string | null
  endTime: string | null
  sortOrder: number
  transportation: string | null
  estimatedCost: number
  note: string | null
  attractionId?: string | null
}

export interface AiPlanDay {
  date: string
  dayNumber: number
  description: string | null
  items: AiPlanItem[]
}

export interface AiPlanRequest {
  tripId: string | null
  destination: string
  startDate: string
  endDate: string
  travelDays: number
  totalBudget: number
  transportation: string | null
  preferences: string[]
  requirements: string | null
}

export interface AiPlan {
  aiPlanId: string
  tripId: string | null
  status: AiPlanStatus
  destination: string
  startDate: string
  endDate: string
  travelDays: number
  estimatedTotal: number | null
  days: AiPlanDay[]
  createdAt: string
  savedAt?: string | null
  errorMessage?: string | null
  request?: AiPlanRequest
}

export interface AiPlanListItem {
  aiPlanId: string
  tripId: string | null
  status: AiPlanStatus
  destination: string
  estimatedTotal: number | null
  createdAt: string
  savedAt: string | null
  errorMessage: string | null
}

export interface AiPlanQuery extends PageQuery {
  status?: AiPlanStatus | ''
}

export interface AiGeneratePayload {
  tripId: string | null
  destination: string
  startDate: string
  endDate: string
  travelDays: number
  totalBudget: number
  transportation?: string | null
  preferences?: string[]
  requirements?: string | null
}

export interface AiSavePayload {
  tripId: string
  confirmOverwrite: boolean
  days: AiPlanDay[]
}

export interface AiSaveResult {
  aiPlanId: string
  tripId: string
  status: AiPlanStatus
  savedDays: number
  savedItems: number
  savedAt: string
}

/* ===== 统计 ===== */
export interface StatisticsOverview {
  totalTrips: number
  totalTravelDays: number
  totalActualExpense: number
  totalBudget: number
  ongoingTrips: number
  finishedTrips: number
  upcomingTrips: number
}

export interface CategoryStatItem {
  category: ExpenseCategory
  name: string
  amount: number
  percentage: number
}

export interface CategoryStatistics {
  totalAmount: number
  items: CategoryStatItem[]
}

export interface TripCostItem {
  tripId: string
  title: string
  actualExpense: number
}

export interface TripCostsResult {
  items: TripCostItem[]
}

export interface BudgetComparisonItem {
  tripId: string
  title: string
  totalBudget: number
  actualExpense: number
  remainingBudget: number
  overBudget: boolean
}

export interface BudgetComparisonResult {
  items: BudgetComparisonItem[]
}
