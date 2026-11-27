import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
import dayjs from 'dayjs'
import { axiosInstance } from '@/utils/request'
import {
  MOCK_TOKEN,
  MOCK_USER_ID,
  buildAiDays,
  buildBudgetSummary,
  buildDaysResult,
  getDb,
  nextId,
  nowString,
  resetDb,
  round2,
  saveDb,
  toTripDto,
  type MockAiPlan,
  type MockDay,
  type MockDb,
  type MockTrip,
  type MockUser
} from './db'
import type {
  AiPlan,
  AiPlanDay,
  AiPlanRequest,
  AiPlanStatus,
  Attraction,
  Expense,
  ExpenseCategory,
  ItineraryItem,
  PageResult,
  Trip,
  TripStatus
} from '@/types/api'
import type {Conversation} from '@/api/conversation'
import {byStartTime} from '@/utils/schedule'

/* ================= 基础工具 ================= */

interface Envelope {
  code: number
  message: string
  data: unknown
}

function ok<T>(data: T): Envelope {
  return { code: 0, message: 'success', data }
}

function fail(code: number, message: string): Envelope {
  return { code, message, data: null }
}

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  FOOD: '餐饮',
  TRANSPORT: '交通',
  HOTEL: '住宿',
  TICKET: '门票',
  SHOPPING: '购物',
  OTHER: '其他'
}

const CATEGORY_SET = Object.keys(CATEGORY_NAMES) as ExpenseCategory[]

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function paginate<T>(list: T[], page = 1, size = 10): PageResult<T> {
  const safeSize = Math.min(Math.max(Number(size) || 10, 1), 50)
  const safePage = Math.max(Number(page) || 1, 1)
  const start = (safePage - 1) * safeSize
  return {
    list: list.slice(start, start + safeSize),
    total: list.length,
    page: safePage,
    size: safeSize
  }
}

function userDto(user: MockUser) {
  return {
    userId: user.userId,
    username: user.username,
    nickname: user.nickname,
    createdAt: user.createdAt
  }
}

function findTrip(db: MockDb, tripId: string): MockTrip | undefined {
  return db.trips.find((trip) => trip.tripId === tripId && trip.userId === MOCK_USER_ID)
}

function attractionDto(db: MockDb, attraction: Attraction): Attraction {
  return {
    ...attraction,
    isOwner: attraction.createdBy === MOCK_USER_ID,
    isFavorited: db.favorites.some(
      (favorite) => favorite.userId === MOCK_USER_ID && favorite.attractionId === attraction.attractionId
    )
  }
}

function expenseDto(expense: Expense): Expense {
  return { ...expense, amount: Number(expense.amount) }
}

function tripExpenses(db: MockDb, tripId: string): Expense[] {
  return db.expenses
    .filter((expense) => expense.tripId === tripId)
    .slice()
    .sort((a, b) => (a.spentOn === b.spentOn ? Number(b.expenseId) - Number(a.expenseId) : a.spentOn < b.spentOn ? 1 : -1))
}

function tripItems(db: MockDb, tripId: string): ItineraryItem[] {
  const dayIds = db.days.filter((day) => day.tripId === tripId).map((day) => day.dayId)
  return db.items.filter((item) => dayIds.includes(item.dayId))
}

function planDto(plan: MockAiPlan): AiPlan {
  const { userId, ...rest } = plan
  return { ...rest }
}

function planListItem(plan: MockAiPlan) {
  return {
    aiPlanId: plan.aiPlanId,
    tripId: plan.tripId,
    status: plan.status,
    destination: plan.destination,
    estimatedTotal: plan.estimatedTotal,
    createdAt: plan.createdAt,
    savedAt: plan.savedAt ?? null,
    errorMessage: plan.errorMessage ?? null
  }
}

function statusFilterMatch(db: MockDb, trip: MockTrip, status?: string): boolean {
  if (!status) return true
  return toTripDto(db, trip).tripStatus === status
}

/* ================= 各模块处理 ================= */

function handleTripList(db: MockDb, query: Record<string, string>): Envelope {
  const keyword = (query.keyword || '').trim()
  const status = (query.status || '') as TripStatus | ''
  let list = db.trips.filter((trip) => trip.userId === MOCK_USER_ID)
  if (keyword) {
    list = list.filter(
      (trip) => trip.title.includes(keyword) || trip.destination.includes(keyword)
    )
  }
  if (status) list = list.filter((trip) => statusFilterMatch(db, trip, status))
  list = list
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : Number(b.tripId) - Number(a.tripId)))
  const paged = paginate(list.map((trip) => toTripDto(db, trip)), Number(query.page) || 1, Number(query.size) || 10)
  return ok(paged)
}

function handleTripCreate(db: MockDb, body: Record<string, any>): Envelope {
  const title = String(body.title || '').trim()
  const destination = String(body.destination || '').trim()
  const startDate = String(body.startDate || '')
  const endDate = String(body.endDate || '')
  const totalBudget = Number(body.totalBudget ?? 0)

  if (!title || title.length > 120) return fail(40001, '旅行名称长度为 1-120 个字符')
  if (!destination || destination.length > 120) return fail(40001, '目的地长度为 1-120 个字符')
  if (!startDate || !endDate) return fail(40001, '请选择出行日期')
  if (endDate < startDate) return fail(42200, '结束日期不能早于开始日期')
  if (!(totalBudget >= 0) || totalBudget > 9999999999.99) return fail(40001, '预算超出允许范围')

  const trip: MockTrip = {
    tripId: nextId(db),
    userId: MOCK_USER_ID,
    title,
    destination,
    startDate,
    endDate,
    totalBudget: round2(totalBudget),
    createdAt: nowString(),
    updatedAt: nowString()
  }
  db.trips.push(trip)
  saveDb()
  return ok(toTripDto(db, trip))
}

function handleTripUpdate(db: MockDb, trip: MockTrip, body: Record<string, any>): Envelope {
  const nextStart = body.startDate !== undefined ? String(body.startDate) : trip.startDate
  const nextEnd = body.endDate !== undefined ? String(body.endDate) : trip.endDate

  if (nextEnd < nextStart) return fail(42200, '结束日期不能早于开始日期')

  if (nextStart !== trip.startDate || nextEnd !== trip.endDate) {
    const outsideDay = db.days.some(
      (day) => day.tripId === trip.tripId && (day.date < nextStart || day.date > nextEnd)
    )
    const outsideExpense = db.expenses.some(
      (expense) => expense.tripId === trip.tripId && (expense.spentOn < nextStart || expense.spentOn > nextEnd)
    )
    if (outsideDay || outsideExpense) {
      return fail(42200, '已有行程或消费落在新的日期范围之外，请先调整子数据')
    }
  }

  if (body.title !== undefined) trip.title = String(body.title).trim()
  if (body.destination !== undefined) trip.destination = String(body.destination).trim()
  trip.startDate = nextStart
  trip.endDate = nextEnd
  if (body.totalBudget !== undefined) trip.totalBudget = round2(Number(body.totalBudget) || 0)
  trip.updatedAt = nowString()
  saveDb()
  return ok(toTripDto(db, trip))
}

function handleTripDelete(db: MockDb, trip: MockTrip): Envelope {
  const dayIds = db.days.filter((day) => day.tripId === trip.tripId).map((day) => day.dayId)
  db.items = db.items.filter((item) => !dayIds.includes(item.dayId))
  db.days = db.days.filter((day) => day.tripId !== trip.tripId)
  db.expenses = db.expenses.filter((expense) => expense.tripId !== trip.tripId)
  db.trips = db.trips.filter((item) => item.tripId !== trip.tripId)
  // AI 历史保留，trip_id 置空
  db.aiPlans.forEach((plan) => {
    if (plan.tripId === trip.tripId) plan.tripId = null
  })
  saveDb()
  return ok({ deleted: true, tripId: trip.tripId })
}

function handlePoiSearch(query: Record<string, string>): Envelope {
  const keywords = String(query.keywords || '').trim()
  const region = String(query.region || '').trim()
  if (!keywords) return fail(40001, '关键词不能为空')
  if (!region) return fail(40001, '城市不能为空')

  const list = [
    {
      name: `${region}${keywords}中心`,
      address: `${region}示例路 88 号`,
      city: region,
      district: '示例区',
      type: '风景名胜',
      longitude: 106.5516,
      latitude: 29.563
    },
    {
      name: `${keywords}文化街区`,
      address: `${region}示例街 12 号`,
      city: region,
      district: '示例区',
      type: '文化场馆',
      longitude: 106.562,
      latitude: 29.5571
    },
    {
      name: `${keywords}公园`,
      address: `${region}示例大道 300 号`,
      city: region,
      district: '示例区',
      type: '公园广场',
      longitude: 106.54,
      latitude: 29.57
    }
  ]
  return ok({ source: 'AMAP_LIVE', page: 1, size: 10, list })
}

function handleAttractionCreate(db: MockDb, body: Record<string, any>): Envelope {
  const name = String(body.name || '').trim()
  const city = String(body.city || '').trim()
  if (!name || name.length > 120) return fail(40001, '景点名称长度为 1-120 个字符')
  if (!city || city.length > 80) return fail(40001, '城市长度为 1-80 个字符')

  const attraction: Attraction = {
    attractionId: nextId(db),
    createdBy: MOCK_USER_ID,
    name,
    city,
    category: body.category ? String(body.category) : null,
    description: body.description ? String(body.description) : null,
    suggestedDurationMinutes:
      body.suggestedDurationMinutes === null || body.suggestedDurationMinutes === undefined
        ? null
        : Number(body.suggestedDurationMinutes),
    referenceTicketPrice:
      body.referenceTicketPrice === null || body.referenceTicketPrice === undefined
        ? null
        : round2(Number(body.referenceTicketPrice)),
    isOwner: true,
    isFavorited: false
  }
  db.attractions.push(attraction)
  saveDb()
  return ok(attractionDto(db, attraction))
}

function handleExpenseCreate(db: MockDb, trip: MockTrip, body: Record<string, any>): Envelope {
  const category = String(body.category || '') as ExpenseCategory
  const amount = Number(body.amount ?? 0)
  const spentOn = String(body.spentOn || '')
  const description = body.description ? String(body.description) : null

  if (!CATEGORY_SET.includes(category)) return fail(40001, '消费类别不合法')
  if (!(amount > 0)) return fail(40001, '金额必须大于 0')
  if (!spentOn || spentOn < trip.startDate || spentOn > trip.endDate) {
    return fail(42200, '消费日期需在旅行日期范围内')
  }
  if (description && description.length > 300) return fail(40001, '说明最多 300 字')

  const expense: Expense = {
    expenseId: nextId(db),
    tripId: trip.tripId,
    category,
    amount: round2(amount),
    spentOn,
    description,
    createdAt: nowString()
  }
  db.expenses.push(expense)
  saveDb()
  return ok(expenseDto(expense))
}

function handleExpenseUpdate(db: MockDb, expense: Expense, body: Record<string, any>): Envelope {
  const trip = db.trips.find((item) => item.tripId === expense.tripId)
  if (!trip) return fail(40400, '消费记录不存在')

  if (body.category !== undefined) {
    if (!CATEGORY_SET.includes(body.category)) return fail(40001, '消费类别不合法')
    expense.category = body.category
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount)
    if (!(amount > 0)) return fail(40001, '金额必须大于 0')
    expense.amount = round2(amount)
  }
  if (body.spentOn !== undefined) {
    const spentOn = String(body.spentOn)
    if (spentOn < trip.startDate || spentOn > trip.endDate) {
      return fail(42200, '消费日期需在旅行日期范围内')
    }
    expense.spentOn = spentOn
  }
  if (body.description !== undefined) {
    const description = body.description ? String(body.description) : null
    if (description && description.length > 300) return fail(40001, '说明最多 300 字')
    expense.description = description
  }
  saveDb()
  return ok(expenseDto(expense))
}

function positionMockItem(db:MockDb,item:ItineraryItem,position:number,byTime:boolean){
  const others=db.items.filter(row=>row.dayId===item.dayId&&row.itemId!==item.itemId).sort((a,b)=>a.sortOrder-b.sortOrder)
  let ordered:ItineraryItem[]
  if(byTime)ordered=byStartTime([...others,item])
  else {others.splice(Math.max(0,Math.min(position-1,others.length)),0,item);ordered=others}
  ordered.forEach((row,index)=>{row.sortOrder=index+1})
}

function handleItemCreate(db: MockDb, trip: MockTrip, date: string, body: Record<string, any>): Envelope {
  if (!date || date < trip.startDate || date > trip.endDate) {
    return fail(42200, '行程日期需在旅行日期范围内')
  }
  const itemName = String(body.itemName || '').trim()
  if (!itemName || itemName.length > 150) return fail(40001, '活动名称长度为 1-150 个字符')

  if (body.startTime && body.endTime && body.endTime < body.startTime) {
    return fail(40001, '结束时间不能早于开始时间')
  }
  if (body.attractionId && !db.attractions.some((a) => a.attractionId === body.attractionId)) {
    return fail(40001, '关联景点不存在')
  }

  let day = db.days.find((item: MockDay) => item.tripId === trip.tripId && item.date === date)
  if (!day) {
    day = { dayId: nextId(db), tripId: trip.tripId, date, description: null }
    db.days.push(day)
  }

  const siblings = db.items.filter((item) => item.dayId === day!.dayId)
  const item: ItineraryItem = {
    itemId: nextId(db),
    dayId: day.dayId,
    attractionId: body.attractionId || null,
    itemName,
    startTime: body.startTime || null,
    endTime: body.endTime || null,
    sortOrder: Number(body.sortOrder) > 0 ? Number(body.sortOrder) : siblings.length + 1,
    transportation: body.transportation || null,
    estimatedCost: round2(Number(body.estimatedCost) || 0),
    sourceType: 'MANUAL',
    note: body.note ? String(body.note) : null
  }
  db.items.push(item)
  positionMockItem(db,item,item.sortOrder,Boolean(item.startTime))
  saveDb()
  return ok(item)
}

function handleItemUpdate(db: MockDb, item: ItineraryItem, body: Record<string, any>): Envelope {
  const next={...item}
  if (body.itemName !== undefined) {
    const itemName = String(body.itemName).trim()
    if (!itemName || itemName.length > 150) return fail(40001, '活动名称长度为 1-150 个字符')
    next.itemName = itemName
  }
  if (body.attractionId !== undefined) {
    if (body.attractionId && !db.attractions.some((a) => a.attractionId === body.attractionId)) {
      return fail(40001, '关联景点不存在')
    }
    next.attractionId = body.attractionId || null
  }
  if (body.startTime !== undefined) next.startTime = body.startTime || null
  if (body.endTime !== undefined) next.endTime = body.endTime || null
  if (next.startTime && next.endTime && next.endTime < next.startTime) {
    return fail(40001, '结束时间不能早于开始时间')
  }
  if (body.transportation !== undefined) next.transportation = body.transportation || null
  if (body.estimatedCost !== undefined) next.estimatedCost = round2(Number(body.estimatedCost) || 0)
  if (body.note !== undefined) next.note = body.note ? String(body.note) : null
  if (body.sortOrder !== undefined && Number(body.sortOrder) > 0) next.sortOrder = Number(body.sortOrder)
  const timeChanged=(item.startTime||null)!==(next.startTime||null)
  Object.assign(item,next)
  positionMockItem(db,item,item.sortOrder,timeChanged)
  saveDb()
  return ok(item)
}

function handleAiGenerate(db: MockDb, body: Record<string, any>): Envelope {
  const destination = String(body.destination || '').trim()
  const startDate = String(body.startDate || '')
  const endDate = String(body.endDate || '')
  const travelDays = Number(body.travelDays || 0)
  const totalBudget = Number(body.totalBudget ?? 0)
  const preferences: string[] = Array.isArray(body.preferences) ? body.preferences : []
  const requirements = body.requirements ? String(body.requirements) : null

  if (!destination) return fail(40001, '目的地不能为空')
  if (!startDate || !endDate || endDate < startDate) return fail(42200, '日期范围不合法')
  const expectedDays = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
  if (travelDays !== expectedDays) return fail(42200, 'travelDays 必须等于首末日期含端点的天数')
  if (travelDays < 1 || travelDays > 15) return fail(40001, '旅行天数需在 1-15 天之间')
  if (preferences.length > 10) return fail(40001, '偏好最多 10 项')
  if (requirements && requirements.length > 500) return fail(40001, '附加要求最多 500 字')

  let tripId: string | null = body.tripId ? String(body.tripId) : null
  if (tripId) {
    const trip = findTrip(db, tripId)
    if (!trip) return fail(40400, '关联的旅行不存在')
    if (trip.startDate !== startDate || trip.endDate !== endDate || trip.destination !== destination) {
      return fail(42200, '旅行目的地或日期与生成条件不一致')
    }
  }

  const request: AiPlanRequest = {
    tripId,
    destination,
    startDate,
    endDate,
    travelDays,
    totalBudget: round2(totalBudget),
    transportation: body.transportation ? String(body.transportation) : null,
    preferences,
    requirements
  }

  const days = buildAiDays(request)
  const estimatedTotal = round2(
    days.reduce(
      (sum, day) => sum + day.items.reduce((inner, item) => inner + Number(item.estimatedCost), 0),
      0
    )
  )

  const plan: MockAiPlan = {
    aiPlanId: nextId(db),
    userId: MOCK_USER_ID,
    tripId,
    status: 'DRAFT',
    destination,
    startDate,
    endDate,
    travelDays,
    estimatedTotal,
    days,
    createdAt: nowString(),
    savedAt: null,
    errorMessage: null,
    request
  }
  db.aiPlans.push(plan)
  saveDb()
  return ok(planDto(plan))
}

function handleAiSave(db: MockDb, plan: MockAiPlan, body: Record<string, any>): Envelope {
  if (plan.status === 'SAVED') return fail(40900, '该规划已保存过，请直接查看对应旅行')
  if (plan.status === 'FAILED') return fail(40900, '失败的规划不能保存')

  const tripId = String(body.tripId || plan.tripId || '')
  const trip = findTrip(db, tripId)
  if (!trip) return fail(40400, '目标旅行不存在')
  if (plan.tripId && plan.tripId !== tripId) return fail(42200, '草稿已绑定其他旅行')
  if (trip.destination !== plan.destination || trip.startDate !== plan.startDate || trip.endDate !== plan.endDate) {
    return fail(42200, '目标旅行的目的地与日期必须和规划条件一致')
  }

  const days: AiPlanDay[] = Array.isArray(body.days) ? body.days : []
  if (days.length === 0) return fail(40001, '行程不能为空')
  if (new Set(days.map((day) => day.date)).size !== days.length) {
    return fail(40001, '行程日期存在重复')
  }
  for (const day of days) {
    if (day.date < trip.startDate || day.date > trip.endDate) {
      return fail(42200, `日期 ${day.date} 不在旅行范围内`)
    }
    for (const item of day.items || []) {
      if (!item.itemName || !String(item.itemName).trim()) {
        return fail(40001, '行程项名称不能为空')
      }
    }
  }

  const existing = tripItems(db, trip.tripId)
  if (existing.length > 0 && !body.confirmOverwrite) {
    return fail(40900, '目标旅行已有行程，是否覆盖？')
  }

  // 覆盖：清空该旅行在日期范围内的行程项
  const dayIds = db.days.filter((day) => day.tripId === trip.tripId).map((day) => day.dayId)
  db.items = db.items.filter((item) => !dayIds.includes(item.dayId))
  db.days = db.days.filter((day) => day.tripId !== trip.tripId)

  let savedItems = 0
  for (const day of days) {
    const mockDay: MockDay = {
      dayId: nextId(db),
      tripId: trip.tripId,
      date: day.date,
      description: day.description || null
    }
    db.days.push(mockDay)
    const items = (day.items || []).map((item, index) => {
      savedItems += 1
      return {
        itemId: nextId(db),
        dayId: mockDay.dayId,
        attractionId: item.attractionId || null,
        itemName: String(item.itemName).trim(),
        startTime: item.startTime || null,
        endTime: item.endTime || null,
        sortOrder: index + 1,
        transportation: item.transportation || null,
        estimatedCost: round2(Number(item.estimatedCost) || 0),
        sourceType: 'AI' as const,
        note: item.note || null
      }
    })
    db.items.push(...items)
  }

  plan.tripId = trip.tripId
  plan.status = 'SAVED'
  plan.savedAt = nowString()
  saveDb()

  return ok({
    aiPlanId: plan.aiPlanId,
    tripId: trip.tripId,
    status: 'SAVED',
    savedDays: days.length,
    savedItems,
    savedAt: plan.savedAt
  })
}

/* ================= 路由 ================= */

function handleConversation(db:MockDb,method:string,path:string,query:Record<string,string>,body:Record<string,any>):Envelope {
  const rows=db.conversations ||= []
  if(path==='/ai/conversations'&&method==='get')return ok(paginate([...rows].reverse(),Number(query.page)||1,20))
  if(path==='/ai/conversations'&&method==='post'){
    const source=body.aiPlanId?db.aiPlans.find(p=>p.aiPlanId===String(body.aiPlanId)&&p.userId===MOCK_USER_ID):null
    if(body.aiPlanId&&!source)return fail(40400,'方案不存在')
    const conditions=source?.request||body.conditions
    if(!conditions?.destination||!conditions.startDate||!conditions.endDate)return fail(40001,'请填写完整旅行条件')
    const chat:Conversation={conversationId:nextId(db),title:conditions.destination+' · '+conditions.travelDays+'天旅行',version:0,processing:false,conditions,currentPlan:source?planDto(source):null,currentDays:body.currentDays||source?.days||null,memory:'',messages:[],createdAt:nowString(),updatedAt:nowString()}
    rows.push(chat);saveDb();return ok(chat)
  }
  const match=path.match(/^\/ai\/conversations\/(\d+)(?:\/(messages(?:\/submit)?|draft))?$/),row=rows.find(r=>r.conversationId===match?.[1])
  if(!row)return fail(40400,'会话不存在')
  if(row.currentPlan){const latest=db.aiPlans.find(p=>p.aiPlanId===row.currentPlan?.aiPlanId);if(latest)row.currentPlan=planDto(latest)}
  if(method==='get')return ok(row)
  if(method==='delete'){db.conversations=rows.filter(r=>r!==row);saveDb();return ok({deleted:true})}
  if(match?.[2]?.startsWith('messages')&&method==='post'){
    if(row.messages.some(m=>m.requestId===body.requestId))return ok(row)
    if(body.expectedVersion!==row.version)return fail(40900,'会话已更新，请刷新')
    if(body.currentDays)row.currentDays=body.currentDays
    const changed=body.intent==='REVISE'||(body.intent==='AUTO'&&/生成|调整|减少|增加|改成/.test(body.content))
    let linked:string|null=null
    if(changed){const generated=handleAiGenerate(db,{...row.conditions,requirements:String(body.content).slice(0,500)});if(generated.code!==0)return generated;row.currentPlan=generated.data as AiPlan;row.currentDays=row.currentPlan.days;linked=row.currentPlan.aiPlanId}
    const stamp=nowString()
    row.messages.push({messageId:nextId(db),requestId:body.requestId,role:'user',content:body.content,status:'COMPLETED',errorMessage:null,planId:null,createdAt:stamp})
    row.messages.push({messageId:nextId(db),requestId:body.requestId,role:'assistant',content:changed?'演示回复：已生成模拟行程。真实 AI 会结合历史消息与当前编辑继续调整。':'演示回复：通常可以按相邻区域安排景点，减少转场；本轮保留当前方案。此回复为本地模拟。',status:'COMPLETED',errorMessage:null,planId:linked,createdAt:stamp})
    row.version+=2;row.updatedAt=stamp;row.memory=String(row.conditions.requirements||'')+'；'+String(body.content).slice(0,500);saveDb();return ok(row)
  }
  if(match?.[2]==='draft'&&method==='put'){
    if(body.expectedVersion!==row.version||row.currentPlan?.status!=='DRAFT')return fail(40900,'会话已更新或草稿不能编辑')
    row.currentDays=body.days;row.version++;row.updatedAt=nowString();saveDb();return ok(row)
  }
  return fail(40400,'会话操作不存在')
}

function handleRequest(method: string, path: string, query: Record<string, string>, bodyRaw: unknown): Envelope {
  const db = getDb()
  const body: Record<string, any> = typeof bodyRaw === 'string' ? safeParse(bodyRaw)
    : bodyRaw && typeof bodyRaw === 'object' && !Array.isArray(bodyRaw) ? bodyRaw as Record<string, any> : {}

  if(path.startsWith('/ai/conversations'))return handleConversation(db,method,path,query,body)
  /* --- auth --- */
  if (method === 'post' && path === '/auth/register') {
    const username = String(body.username || '').trim()
    const password = String(body.password || '')
    const confirmPassword = String(body.confirmPassword || '')
    if (!username || username.length > 50) return fail(40001, '用户名长度为 1-50 个字符')
    if (password.length < 8 || password.length > 72) return fail(40001, '密码长度应为 8-72 个字符')
    if (password !== confirmPassword) return fail(40001, '两次输入的密码不一致')
    if (db.users.some((user) => user.username === username)) return fail(40900, '用户名已存在')
    const user: MockUser = {
      userId: nextId(db),
      username,
      password,
      nickname: body.nickname ? String(body.nickname) : username,
      createdAt: nowString()
    }
    db.users.push(user)
    saveDb()
    return ok({ userId: user.userId, username: user.username, nickname: user.nickname })
  }

  if (method === 'post' && path === '/auth/login') {
    const user = db.users.find((item) => item.username === String(body.username || '').trim())
    if (!user || user.password !== String(body.password || '')) {
      return fail(40100, '账号或密码错误')
    }
    return ok({
      accessToken: MOCK_TOKEN,
      tokenType: 'Bearer',
      expiresIn: 86400,
      user: userDto(user)
    })
  }

  if (method === 'post' && path === '/auth/logout') {
    return ok({ loggedOut: true })
  }

  const currentUser = db.users.find((user) => user.userId === MOCK_USER_ID)!

  if (method === 'get' && path === '/users/me') return ok(userDto(currentUser))

  if (method === 'patch' && path === '/users/me') {
    if (body.nickname !== undefined) {
      const nickname = String(body.nickname)
      if (nickname.length > 60) return fail(40001, '昵称最多 60 个字符')
      currentUser.nickname = nickname
      saveDb()
    }
    return ok(userDto(currentUser))
  }

  if (method === 'patch' && path === '/users/me/password') {
    if (currentUser.password !== String(body.oldPassword || '')) return fail(42200, '当前密码不正确')
    const newPassword = String(body.newPassword || '')
    if (newPassword.length < 8 || newPassword.length > 72) return fail(40001, '新密码长度应为 8-72 个字符')
    if (newPassword !== String(body.confirmPassword || '')) return fail(40001, '两次输入的密码不一致')
    currentUser.password = newPassword
    saveDb()
    return ok({ updated: true })
  }

  /* --- trips --- */
  if (method === 'get' && path === '/trips') return handleTripList(db, query)
  if (method === 'post' && path === '/trips') return handleTripCreate(db, body)

  const tripMatch = path.match(/^\/trips\/([^/]+)$/)
  if (tripMatch) {
    const trip = findTrip(db, tripMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    if (method === 'get') return ok(toTripDto(db, trip))
    if (method === 'patch') return handleTripUpdate(db, trip, body)
    if (method === 'delete') return handleTripDelete(db, trip)
  }

  /* --- pois --- */
  if (method === 'get' && path === '/pois/search') return handlePoiSearch(query)

  /* --- attractions --- */
  if (method === 'get' && path === '/attractions') {
    const keyword = (query.keyword || '').trim()
    const city = (query.city || '').trim()
    const mineOnly = String(query.mineOnly) === 'true'
    let list = db.attractions.slice()
    if (mineOnly) list = list.filter((item) => item.createdBy === MOCK_USER_ID)
    if (keyword) list = list.filter((item) => item.name.includes(keyword) || (item.description || '').includes(keyword))
    if (city) list = list.filter((item) => item.city.includes(city))
    list = list
      .map((item) => attractionDto(db, item))
      .sort((a, b) => (Number(b.attractionId) || 0) - (Number(a.attractionId) || 0))
    return ok(paginate(list, Number(query.page) || 1, Number(query.size) || 10))
  }

  if (method === 'post' && path === '/attractions') return handleAttractionCreate(db, body)

  const attractionMatch = path.match(/^\/attractions\/([^/]+)$/)
  if (attractionMatch) {
    const attraction = db.attractions.find((item) => item.attractionId === attractionMatch[1])
    if (!attraction) return fail(40400, '景点不存在')
    if (method === 'get') return ok(attractionDto(db, attraction))
    if (method === 'patch' || method === 'delete') {
      if (attraction.createdBy !== MOCK_USER_ID) return fail(40400, '景点不存在')
      if (method === 'patch') {
        if (body.name !== undefined) attraction.name = String(body.name).trim()
        if (body.city !== undefined) attraction.city = String(body.city).trim()
        if (body.category !== undefined) attraction.category = body.category || null
        if (body.description !== undefined) attraction.description = body.description || null
        if (body.suggestedDurationMinutes !== undefined) {
          attraction.suggestedDurationMinutes =
            body.suggestedDurationMinutes === null ? null : Number(body.suggestedDurationMinutes)
        }
        if (body.referenceTicketPrice !== undefined) {
          attraction.referenceTicketPrice =
            body.referenceTicketPrice === null ? null : round2(Number(body.referenceTicketPrice))
        }
        saveDb()
        return ok(attractionDto(db, attraction))
      }
      db.attractions = db.attractions.filter((item) => item.attractionId !== attraction.attractionId)
      db.favorites = db.favorites.filter((item) => item.attractionId !== attraction.attractionId)
      db.items.forEach((item) => {
        if (item.attractionId === attraction.attractionId) item.attractionId = null
      })
      saveDb()
      return ok({ deleted: true })
    }
  }

  /* --- favorites --- */
  if (method === 'get' && path === '/favorites') {
    const keyword = (query.keyword || '').trim()
    const city = (query.city || '').trim()
    let list = db.favorites
      .filter((item) => item.userId === MOCK_USER_ID)
      .map((favorite) => {
        const attraction = db.attractions.find((item) => item.attractionId === favorite.attractionId)
        return attraction
          ? {
              favoriteId: favorite.favoriteId,
              createdAt: favorite.createdAt,
              attraction: attractionDto(db, attraction)
            }
          : null
      })
      .filter(Boolean) as Array<{ favoriteId: string; createdAt: string; attraction: Attraction }>
    if (keyword) list = list.filter((item) => item.attraction.name.includes(keyword))
    if (city) list = list.filter((item) => item.attraction.city.includes(city))
    return ok(paginate(list, Number(query.page) || 1, Number(query.size) || 10))
  }

  if (method === 'post' && path === '/favorites') {
    const attractionId = String(body.attractionId || '')
    if (!db.attractions.some((item) => item.attractionId === attractionId)) {
      return fail(40400, '景点不存在，只能收藏本地自建景点')
    }
    if (db.favorites.some((item) => item.userId === MOCK_USER_ID && item.attractionId === attractionId)) {
      return fail(40900, '已经收藏过该景点')
    }
    const favorite = {
      favoriteId: nextId(db),
      userId: MOCK_USER_ID,
      attractionId,
      createdAt: nowString()
    }
    db.favorites.push(favorite)
    saveDb()
    return ok({ favoriteId: favorite.favoriteId, attractionId })
  }

  const favoriteMatch = path.match(/^\/favorites\/([^/]+)$/)
  if (favoriteMatch && method === 'delete') {
    const before = db.favorites.length
    db.favorites = db.favorites.filter(
      (item) => !(item.userId === MOCK_USER_ID && item.attractionId === favoriteMatch[1])
    )
    saveDb()
    return ok({ deleted: db.favorites.length < before })
  }

  /* --- itinerary --- */
  const daysMatch = path.match(/^\/trips\/([^/]+)\/days$/)
  if (daysMatch && method === 'get') {
    const trip = findTrip(db, daysMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    return ok(buildDaysResult(db, trip))
  }

  const addItemMatch = path.match(/^\/trips\/([^/]+)\/days\/([^/]+)\/items$/)
  if (addItemMatch && method === 'post') {
    const trip = findTrip(db, addItemMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    return handleItemCreate(db, trip, addItemMatch[2], body)
  }

  const orderMatch = path.match(/^\/trips\/([^/]+)\/days\/([^/]+)\/items\/order$/)
  if (orderMatch && method === 'put') {
    const trip = findTrip(db, orderMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    const day = db.days.find((item) => item.tripId === trip.tripId && item.date === orderMatch[2])
    if (!day) return fail(40400, '该日期没有行程')
    const ids: string[] = Array.isArray(body.itemIds) ? body.itemIds.map(String) : []
    const current = db.items.filter((item) => item.dayId === day.dayId)
    if (ids.length !== current.length || new Set(ids).size !== ids.length) {
      return fail(40001, '必须提交该天全部行程项 ID，且不能重复')
    }
    if (!current.every((item) => ids.includes(item.itemId))) {
      return fail(40001, '提交的行程项不属于该天')
    }
    ids.forEach((id, index) => {
      const item = db.items.find((entry) => entry.itemId === id)
      if (item) item.sortOrder = index + 1
    })
    saveDb()
    return ok(db.items.filter((item) => item.dayId === day.dayId).sort((a, b) => a.sortOrder - b.sortOrder))
  }

  const itemMatch = path.match(/^\/itinerary-items\/([^/]+)$/)
  if (itemMatch) {
    const item = db.items.find((entry) => entry.itemId === itemMatch[1])
    if (!item) return fail(40400, '行程项不存在')
    const day = db.days.find((entry) => entry.dayId === item.dayId)
    const trip = day ? findTrip(db, day.tripId) : undefined
    if (!trip) return fail(40400, '行程项不存在')
    if (method === 'patch') return handleItemUpdate(db, item, body)
    if (method === 'delete') {
      db.items = db.items.filter((entry) => entry.itemId !== item.itemId)
      saveDb()
      return ok({ deleted: true })
    }
  }

  /* --- expenses --- */
  const expensesMatch = path.match(/^\/trips\/([^/]+)\/expenses$/)
  if (expensesMatch) {
    const trip = findTrip(db, expensesMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    if (method === 'get') {
      let list = tripExpenses(db, trip.tripId)
      if (query.category) list = list.filter((item) => item.category === query.category)
      if (query.startDate) list = list.filter((item) => item.spentOn >= query.startDate)
      if (query.endDate) list = list.filter((item) => item.spentOn <= query.endDate)
      return ok(paginate(list.map(expenseDto), Number(query.page) || 1, Number(query.size) || 10))
    }
    if (method === 'post') return handleExpenseCreate(db, trip, body)
  }

  const expenseMatch = path.match(/^\/expenses\/([^/]+)$/)
  if (expenseMatch) {
    const expense = db.expenses.find((item) => item.expenseId === expenseMatch[1])
    if (!expense) return fail(40400, '消费记录不存在')
    const trip = findTrip(db, expense.tripId)
    if (!trip) return fail(40400, '消费记录不存在')
    if (method === 'patch') return handleExpenseUpdate(db, expense, body)
    if (method === 'delete') {
      db.expenses = db.expenses.filter((item) => item.expenseId !== expense.expenseId)
      saveDb()
      return ok({ deleted: true })
    }
  }

  const budgetMatch = path.match(/^\/trips\/([^/]+)\/budget-summary$/)
  if (budgetMatch && method === 'get') {
    const trip = findTrip(db, budgetMatch[1])
    if (!trip) return fail(40400, '旅行不存在')
    return ok(buildBudgetSummary(db, trip))
  }

  /* --- AI --- */
  if (method === 'post' && path === '/ai/plans') return handleAiGenerate(db, body)

  if (method === 'get' && path === '/ai/plans') {
    const status = (query.status || '') as AiPlanStatus | ''
    let list = db.aiPlans.filter((plan) => plan.userId === MOCK_USER_ID)
    if (status) list = list.filter((plan) => plan.status === status)
    list = list.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    return ok(
      paginate(
        list.map(planListItem),
        Number(query.page) || 1,
        Number(query.size) || 10
      )
    )
  }

  const aiSaveMatch = path.match(/^\/ai\/plans\/([^/]+)\/save$/)
  if (aiSaveMatch && method === 'post') {
    const plan = db.aiPlans.find((item) => item.aiPlanId === aiSaveMatch[1] && item.userId === MOCK_USER_ID)
    if (!plan) return fail(40400, 'AI 规划不存在')
    return handleAiSave(db, plan, body)
  }

  const aiDetailMatch = path.match(/^\/ai\/plans\/([^/]+)$/)
  if (aiDetailMatch && method === 'get') {
    const plan = db.aiPlans.find((item) => item.aiPlanId === aiDetailMatch[1] && item.userId === MOCK_USER_ID)
    if (!plan) return fail(40400, 'AI 规划不存在')
    return ok(planDto(plan))
  }

  /* --- statistics --- */
  if (method === 'get' && path === '/statistics/overview') {
    const trips = db.trips.filter((trip) => trip.userId === MOCK_USER_ID)
    const dtoList = trips.map((trip) => toTripDto(db, trip))
    return ok({
      totalTrips: dtoList.length,
      totalTravelDays: dtoList.reduce((sum, trip) => sum + trip.daysCount, 0),
      totalActualExpense: round2(dtoList.reduce((sum, trip) => sum + trip.actualExpense, 0)),
      totalBudget: round2(dtoList.reduce((sum, trip) => sum + trip.totalBudget, 0)),
      ongoingTrips: dtoList.filter((trip) => trip.tripStatus === 'ONGOING').length,
      finishedTrips: dtoList.filter((trip) => trip.tripStatus === 'FINISHED').length,
      upcomingTrips: dtoList.filter((trip) => trip.tripStatus === 'NOT_STARTED').length
    })
  }

  if (method === 'get' && path === '/statistics/expense-categories') {
    const tripId = query.tripId || ''
    let list = db.expenses.filter((expense) => {
      const trip = findTrip(db, expense.tripId)
      return Boolean(trip) && (!tripId || expense.tripId === tripId)
    })
    if (tripId && !findTrip(db, tripId)) return fail(40400, '旅行不存在')
    const totalAmount = round2(list.reduce((sum, expense) => sum + Number(expense.amount), 0))
    const grouped = new Map<ExpenseCategory, number>()
    list.forEach((expense) => {
      grouped.set(expense.category, round2((grouped.get(expense.category) || 0) + Number(expense.amount)))
    })
    const items = [...grouped.entries()]
      .map(([category, amount]) => ({
        category,
        name: CATEGORY_NAMES[category],
        amount,
        percentage: totalAmount ? Number(((amount / totalAmount) * 100).toFixed(2)) : 0
      }))
      .sort((a, b) => b.amount - a.amount)
    return ok({ totalAmount, items })
  }

  if (method === 'get' && path === '/statistics/trip-costs') {
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50)
    const items = db.trips
      .filter((trip) => trip.userId === MOCK_USER_ID)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((trip) => ({
        tripId: trip.tripId,
        title: trip.title,
        actualExpense: toTripDto(db, trip).actualExpense
      }))
    return ok({ items })
  }

  if (method === 'get' && path === '/statistics/budget-comparison') {
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 50)
    const items = db.trips
      .filter((trip) => trip.userId === MOCK_USER_ID)
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, limit)
      .map((trip) => {
        const dto = toTripDto(db, trip)
        return {
          tripId: trip.tripId,
          title: trip.title,
          totalBudget: dto.totalBudget,
          actualExpense: dto.actualExpense,
          remainingBudget: round2(dto.totalBudget - dto.actualExpense),
          overBudget: dto.totalBudget - dto.actualExpense < 0
        }
      })
    return ok({ items })
  }

  return fail(40400, `Mock 未实现该接口：${method.toUpperCase()} ${path}`)
}

function safeParse(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

/* ================= axios 适配器 ================= */

export const mockAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase()
  const url = config.url || ''
  const path = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '') || '/'
  const query = (config.params || {}) as Record<string, string>

  // 模拟网络延迟；AI 生成更慢一些，便于观察加载态
  await sleep(path === '/ai/plans' && method === 'post' ? 1600 : 180 + Math.random() * 220)

  let envelope: Envelope
  try {
    envelope = handleRequest(method, path, query, config.data)
  } catch (error) {
    console.error('[mock] 处理失败', error)
    envelope = fail(50000, 'Mock 处理异常')
  }

  const response: AxiosResponse = {
    data: envelope,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
    request: null
  }
  return response
}

export async function setupMock(): Promise<void> {
  axiosInstance.defaults.adapter = mockAdapter
  // 便于在控制台一键重置演示数据：__resetTravelMockDb()
  ;(window as unknown as Record<string, unknown>).__resetTravelMockDb = () => {
    resetDb()
    window.location.reload()
  }
  console.info(
    '%c[Mock 模式] 已接管所有 /api 请求，演示账号 demo_zhang / Test@123456；执行 __resetTravelMockDb() 可重置数据',
    'color:#e6a23c;font-weight:bold'
  )
}
