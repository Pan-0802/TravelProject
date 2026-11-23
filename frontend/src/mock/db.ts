import dayjs from 'dayjs'
import type {
  AiPlan,
  AiPlanDay,
  AiPlanItem,
  AiPlanRequest,
  Attraction,
  BudgetSummary,
  Expense,
  ExpenseCategory,
  ItineraryItem,
  Trip,
  TripStatus
} from '@/types/api'
import { daysBetween } from '@/utils/format'

/**
 * Mock 数据库：只在 npm run dev:mock 时使用。
 * 数据存在 localStorage，刷新页面不会丢，方便在没有后端时演示完整流程。
 */

export interface MockUser {
  userId: string
  username: string
  password: string
  nickname: string
  createdAt: string
}

export interface MockTrip {
  tripId: string
  userId: string
  title: string
  destination: string
  startDate: string
  endDate: string
  totalBudget: number
  createdAt: string
  updatedAt: string
}

export interface MockDay {
  dayId: string
  tripId: string
  date: string
  description: string | null
}

export interface MockFavorite {
  favoriteId: string
  userId: string
  attractionId: string
  createdAt: string
}

export interface MockAiPlan extends AiPlan {
  userId: string
}

export interface MockDb {
  seq: number
  users: MockUser[]
  trips: MockTrip[]
  attractions: Attraction[]
  favorites: MockFavorite[]
  days: MockDay[]
  items: ItineraryItem[]
  expenses: Expense[]
  aiPlans: MockAiPlan[]
}

export const MOCK_TOKEN = 'mock-token-demo'
export const MOCK_USER_ID = '1'
const STORAGE_KEY = 'travel_planner_mock_db_v1'

function now(): string {
  return dayjs().format('YYYY-MM-DDTHH:mm:ss')
}

export function tripStatusOf(trip: MockTrip): TripStatus {
  const today = dayjs().format('YYYY-MM-DD')
  if (today < trip.startDate) return 'NOT_STARTED'
  if (today > trip.endDate) return 'FINISHED'
  return 'ONGOING'
}

function actualExpenseOf(db: MockDb, tripId: string): number {
  return round2(
    db.expenses
      .filter((expense) => expense.tripId === tripId)
      .reduce((sum, expense) => sum + Number(expense.amount), 0)
  )
}

export function round2(value: number): number {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function toTripDto(db: MockDb, trip: MockTrip): Trip {
  return {
    tripId: trip.tripId,
    title: trip.title,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalBudget: Number(trip.totalBudget),
    tripStatus: tripStatusOf(trip),
    daysCount: daysBetween(trip.startDate, trip.endDate),
    actualExpense: actualExpenseOf(db, trip.tripId),
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt
  }
}

export function buildBudgetSummary(db: MockDb, trip: MockTrip): BudgetSummary {
  const list = db.expenses.filter((expense) => expense.tripId === trip.tripId)
  const actualExpense = round2(list.reduce((sum, item) => sum + Number(item.amount), 0))
  const totalBudget = Number(trip.totalBudget)
  const remainingBudget = round2(totalBudget - actualExpense)
  const grouped = new Map<ExpenseCategory, number>()
  for (const expense of list) {
    grouped.set(expense.category, round2((grouped.get(expense.category) || 0) + Number(expense.amount)))
  }
  return {
    tripId: trip.tripId,
    totalBudget,
    actualExpense,
    remainingBudget,
    overBudget: remainingBudget < 0,
    categoryTotals: [...grouped.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
  }
}

/** 每天可能没有真实 trip_day，占位日只存在于响应中 */
export function buildDaysResult(db: MockDb, trip: MockTrip) {
  const start = dayjs(trip.startDate)
  const total = daysBetween(trip.startDate, trip.endDate)
  const days = []
  for (let i = 0; i < total; i += 1) {
    const date = start.add(i, 'day').format('YYYY-MM-DD')
    const day = db.days.find((item) => item.tripId === trip.tripId && item.date === date)
    const items = day
      ? db.items
          .filter((item) => item.dayId === day.dayId)
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : []
    days.push({
      dayId: day ? day.dayId : null,
      date,
      dayNumber: i + 1,
      description: day ? day.description : null,
      items
    })
  }
  return {
    tripId: trip.tripId,
    startDate: trip.startDate,
    endDate: trip.endDate,
    days
  }
}

export function seedDb(): MockDb {
  const createdAt = dayjs().subtract(10, 'day').format('YYYY-MM-DDTHH:mm:ss')
  const tripCreated = dayjs().subtract(5, 'day').format('YYYY-MM-DDTHH:mm:ss')

  const db: MockDb = {
    seq: 1000,
    users: [
      {
        userId: MOCK_USER_ID,
        username: 'demo_zhang',
        password: 'Test@123456',
        nickname: '小张',
        createdAt
      }
    ],
    trips: [
      {
        tripId: '101',
        userId: MOCK_USER_ID,
        title: '重庆三日游',
        destination: '重庆',
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        totalBudget: 1500,
        createdAt: tripCreated,
        updatedAt: tripCreated
      },
      {
        tripId: '102',
        userId: MOCK_USER_ID,
        title: '成都周末游',
        destination: '成都',
        startDate: '2026-11-20',
        endDate: '2026-11-21',
        totalBudget: 800,
        createdAt: dayjs().subtract(20, 'day').format('YYYY-MM-DDTHH:mm:ss'),
        updatedAt: dayjs().subtract(3, 'day').format('YYYY-MM-DDTHH:mm:ss')
      },
      {
        tripId: '103',
        userId: MOCK_USER_ID,
        title: '云南七日游',
        destination: '云南',
        startDate: '2026-12-20',
        endDate: '2026-12-26',
        totalBudget: 6000,
        createdAt: dayjs().subtract(2, 'day').format('YYYY-MM-DDTHH:mm:ss'),
        updatedAt: dayjs().subtract(2, 'day').format('YYYY-MM-DDTHH:mm:ss')
      }
    ],
    attractions: [
      {
        attractionId: '201',
        createdBy: MOCK_USER_ID,
        name: '李子坝观景平台',
        city: '重庆',
        category: '观景',
        description: '看轻轨穿楼的经典位置，建议傍晚去，人相对少一些。',
        suggestedDurationMinutes: 60,
        referenceTicketPrice: 0,
        isOwner: true,
        isFavorited: true
      },
      {
        attractionId: '202',
        createdBy: MOCK_USER_ID,
        name: '鹅岭二厂文创公园',
        city: '重庆',
        category: '人文',
        description: '老厂房改造的文创街区，适合拍照，咖啡馆较多。',
        suggestedDurationMinutes: 120,
        referenceTicketPrice: 0,
        isOwner: true,
        isFavorited: false
      },
      {
        attractionId: '203',
        createdBy: MOCK_USER_ID,
        name: '人民公园鹤鸣茶社',
        city: '成都',
        category: '美食',
        description: '体验盖碗茶和老成都生活节奏，上午人少。',
        suggestedDurationMinutes: 90,
        referenceTicketPrice: 30,
        isOwner: true,
        isFavorited: false
      },
      {
        attractionId: '204',
        createdBy: '2',
        name: '南山一棵树观景台',
        city: '重庆',
        category: '观景',
        description: '看重庆夜景的经典机位（其他用户创建，只能查看和收藏）。',
        suggestedDurationMinutes: 90,
        referenceTicketPrice: 30,
        isOwner: false,
        isFavorited: false
      }
    ],
    favorites: [
      {
        favoriteId: '601',
        userId: MOCK_USER_ID,
        attractionId: '201',
        createdAt: dayjs().subtract(4, 'day').format('YYYY-MM-DDTHH:mm:ss')
      }
    ],
    days: [
      { dayId: '301', tripId: '101', date: '2026-12-01', description: '市区观光' },
      { dayId: '302', tripId: '101', date: '2026-12-02', description: null },
      { dayId: '303', tripId: '102', date: '2026-11-20', description: '宽窄巷子慢逛' }
    ],
    items: [
      {
        itemId: '401',
        dayId: '301',
        attractionId: '201',
        itemName: '李子坝轻轨穿楼',
        startTime: '09:30',
        endTime: '10:30',
        sortOrder: 1,
        transportation: '地铁',
        estimatedCost: 0,
        sourceType: 'MANUAL',
        note: '避开早高峰'
      },
      {
        itemId: '402',
        dayId: '301',
        attractionId: null,
        itemName: '解放碑步行游览',
        startTime: '11:00',
        endTime: '13:00',
        sortOrder: 2,
        transportation: '步行',
        estimatedCost: 0,
        sourceType: 'MANUAL',
        note: null
      },
      {
        itemId: '403',
        dayId: '301',
        attractionId: null,
        itemName: '午餐：小面',
        startTime: '13:00',
        endTime: '14:00',
        sortOrder: 3,
        transportation: '步行',
        estimatedCost: 35,
        sourceType: 'MANUAL',
        note: '附近找一家本地小面馆'
      },
      {
        itemId: '404',
        dayId: '303',
        attractionId: '203',
        itemName: '鹤鸣茶社喝盖碗茶',
        startTime: '10:00',
        endTime: '11:30',
        sortOrder: 1,
        transportation: '步行',
        estimatedCost: 30,
        sourceType: 'MANUAL',
        note: null
      }
    ],
    expenses: [
      {
        expenseId: '501',
        tripId: '101',
        category: 'FOOD',
        amount: 128,
        spentOn: '2026-12-01',
        description: '午餐与小吃',
        createdAt: '2026-12-01T13:20:00'
      },
      {
        expenseId: '502',
        tripId: '101',
        category: 'TRANSPORT',
        amount: 60,
        spentOn: '2026-12-01',
        description: '地铁与打车',
        createdAt: '2026-12-01T20:10:00'
      },
      {
        expenseId: '503',
        tripId: '102',
        category: 'HOTEL',
        amount: 320,
        spentOn: '2026-11-20',
        description: '民宿一晚',
        createdAt: '2026-11-20T21:00:00'
      },
      {
        expenseId: '504',
        tripId: '102',
        category: 'FOOD',
        amount: 210,
        spentOn: '2026-11-21',
        description: '火锅',
        createdAt: '2026-11-21T19:30:00'
      },
      {
        expenseId: '505',
        tripId: '102',
        category: 'TICKET',
        amount: 60,
        spentOn: '2026-11-21',
        description: '景区门票',
        createdAt: '2026-11-21T11:00:00'
      }
    ],
    aiPlans: []
  }

  db.aiPlans.push(seedAiPlan(db))
  return db
}

function seedAiPlan(db: MockDb): MockAiPlan {
  const trip = db.trips[0]
  const request: AiPlanRequest = {
    tripId: trip.tripId,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    travelDays: daysBetween(trip.startDate, trip.endDate),
    totalBudget: trip.totalBudget,
    transportation: '公共交通',
    preferences: ['美食', '人文'],
    requirements: '行程不要太赶，安排一些休息时间'
  }
  const days = buildAiDays(request)
  return {
    aiPlanId: '701',
    userId: MOCK_USER_ID,
    tripId: trip.tripId,
    status: 'DRAFT',
    destination: request.destination,
    startDate: request.startDate,
    endDate: request.endDate,
    travelDays: request.travelDays,
    estimatedTotal: round2(
      days.reduce(
        (sum, day) => sum + day.items.reduce((inner, item) => inner + Number(item.estimatedCost), 0),
        0
      )
    ),
    days,
    createdAt: dayjs().subtract(1, 'day').format('YYYY-MM-DDTHH:mm:ss'),
    savedAt: null,
    errorMessage: null,
    request
  }
}

/** 用简单模板模拟大模型的结构化输出（每天都有活动，字段符合契约） */
export function buildAiDays(request: AiPlanRequest): AiPlanDay[] {
  const start = dayjs(request.startDate)
  const templates = [
    { itemName: '抵达并入住酒店', startTime: '14:00', endTime: '15:30', transportation: '公共交通', cost: 0, note: '建议提前确认入住时间' },
    { itemName: `漫步${request.destination}老城区`, startTime: '16:00', endTime: '18:00', transportation: '步行', cost: 0, note: '适合拍照，注意保管随身物品' },
    { itemName: '当地特色晚餐', startTime: '18:30', endTime: '20:00', transportation: '步行', cost: 80, note: '可参考点评榜单选择' },
    { itemName: '早餐与咖啡', startTime: '08:30', endTime: '09:30', transportation: '步行', cost: 30, note: null },
    { itemName: '博物馆 / 人文景点', startTime: '10:00', endTime: '12:00', transportation: '公共交通', cost: 40, note: '部分场馆需要预约' },
    { itemName: '午餐休息', startTime: '12:30', endTime: '14:00', transportation: '步行', cost: 60, note: null },
    { itemName: '城市公园或观景点', startTime: '15:00', endTime: '17:30', transportation: '公共交通', cost: 20, note: '傍晚光线较好' }
  ]

  const days: AiPlanDay[] = []
  const lastIndex = request.travelDays - 1

  for (let i = 0; i < request.travelDays; i += 1) {
    let picked = templates.slice(0, 3)
    let description = '抵达与市区适应'
    if (i > 0 && i < lastIndex) {
      picked = templates.slice(3, 7)
      description = '城市深度体验'
    } else if (i === lastIndex && lastIndex > 0) {
      picked = templates.slice(3, 6)
      description = '自由活动与返程'
    }

    const items: AiPlanItem[] = picked.map((tpl, index) => ({
      itemName: tpl.itemName,
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      sortOrder: index + 1,
      transportation: tpl.transportation,
      estimatedCost: round2(tpl.cost * (1 + i * 0.05)),
      note: tpl.note
    }))

    days.push({
      date: start.add(i, 'day').format('YYYY-MM-DD'),
      dayNumber: i + 1,
      description,
      items
    })
  }
  return days
}

let cache: MockDb | null = null

export function getDb(): MockDb {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cache = JSON.parse(raw) as MockDb
      return cache
    }
  } catch {
    // 解析失败则回落到种子数据
  }
  cache = seedDb()
  saveDb()
  return cache
}

export function saveDb(): void {
  if (!cache) return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
  } catch {
    // 隐私模式等场景忽略持久化失败
  }
}

export function resetDb(): void {
  cache = seedDb()
  saveDb()
}

export function nextId(db: MockDb, prefix = ''): string {
  db.seq += 1
  return `${prefix}${db.seq}`
}

export function nowString(): string {
  return now()
}
