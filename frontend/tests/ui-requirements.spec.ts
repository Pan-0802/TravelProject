import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const user = { userId: '1', username: 'ui_check', nickname: '张同学', createdAt: '2026-11-27T10:00:00' }
const trip = { tripId: '1', title: '北京轻松游', destination: '北京', startDate: '2026-12-01', endDate: '2026-12-01', daysCount: 1, totalBudget: 1800, actualExpense: 115, tripStatus: 'NOT_STARTED' }
const attraction = { attractionId: '1', name: '故宫博物院', city: '北京', category: '博物馆', suggestedDurationMinutes: 120, referenceTicketPrice: 60, description: '提前预约，按时参观。', isOwner: true, isFavorited: true }
const item = { itemId: '1', itemName: '故宫博物院', attractionId: '1', startTime: '09:00', endTime: '11:00', transportation: '公共交通', estimatedCost: 60, sortOrder: 1, note: '提前预约', sourceType: 'AI' }
const days = [{ dayNumber: 1, date: '2026-12-01', description: '轻松参观博物馆，午后留出休息时间', items: [item] }]
const conditions = { tripId: '1', destination: '北京', startDate: trip.startDate, endDate: trip.endDate, travelDays: 1, totalBudget: 1800, transportation: '公共交通', preferences: [], requirements: '' }
const plan = { aiPlanId: '801', tripId: '1', destination: '北京', startDate: trip.startDate, endDate: trip.endDate, travelDays: 1, estimatedTotal: 60, status: 'DRAFT', days, request: conditions, createdAt: '2026-11-27T10:00:00' }
const conversation = { conversationId: '501', title: '北京 · 1天旅行', version: 2, processing: false, createdAt: plan.createdAt, updatedAt: plan.createdAt, conditions, currentPlan: plan, currentDays: days, memory: '希望轻松游玩', messages: [{ messageId: '1', requestId: 'initial-turn', role: 'user', content: '帮我安排北京一天的旅行，节奏轻松一点。', status: 'COMPLETED', planId: null }, { messageId: '2', requestId: 'initial-turn', role: 'assistant', content: '上午参观故宫，午后留出用餐和休息时间。你可以继续调整每天的安排。', status: 'COMPLETED', planId: '801' }] }
const budget = { tripId: '1', totalBudget: 1800, actualExpense: 115, remainingBudget: 1685, overBudget: false, categoryTotals: [{ category: 'FOOD', amount: 65 }, { category: 'TRANSPORT', amount: 50 }] }
const screenshots = 'test-results/ui-requirements'

async function setup(page: Page) {
  const state = { fieldErrors: {} as Record<string, string>, saveErrors: {} as Record<string, string>, writes: [] as string[] }
  await page.addInitScript(value => {
    sessionStorage.setItem('accessToken', 'ui-requirements-token')
    sessionStorage.setItem('currentUser', JSON.stringify(value))
    const fonts = new Set<string>(); (window as any).__chartFonts = fonts
    const native = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
      fonts.add(this.font)
      return maxWidth === undefined ? native.call(this, text, x, y) : native.call(this, text, x, y, maxWidth)
    }
  }, user)
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const url = new URL(route.request().url()), path = url.pathname, method = route.request().method()
    if (method !== 'GET') state.writes.push(path)
    const fields = method === 'POST' && path === '/api/ai/conversations' ? state.fieldErrors : method === 'POST' && path.endsWith('/save') ? state.saveErrors : {}
    if (Object.keys(fields).length) return route.fulfill({ status: 422, json: { code: 42200, message: '请检查填写内容', data: { fieldErrors: fields } } })
    const list = (factory: (i: number) => unknown) => {
      const n = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('size') || 20)
      return { list: Array.from({ length: 21 }, (_, i) => factory(i + 1)).slice((n - 1) * size, n * size), total: 21, page: n, size }
    }
    let data: unknown
    if (path === '/api/users/me') data = user
    else if (path === '/api/trips') data = list(i => ({ ...trip, tripId: String(i), title: '北京轻松游' + i }))
    else if (path === '/api/trips/1') data = trip
    else if (path.endsWith('/days')) data = { tripId: '1', days }
    else if (path.endsWith('/budget-summary')) data = budget
    else if (path.endsWith('/expenses')) data = list(i => ({ expenseId: String(i), tripId: '1', category: 'FOOD', amount: 65, spentOn: trip.startDate, description: '午餐消费' }))
    else if (path === '/api/attractions') data = list(i => ({ ...attraction, attractionId: String(i) }))
    else if (path === '/api/favorites') data = list(i => ({ favoriteId: String(i), attraction, createdAt: plan.createdAt }))
    else if (path === '/api/ai/conversations') data = method === 'GET' ? list(i => ({ ...conversation, conversationId: String(i + 500), title: '北京旅行对话' + i })) : conversation
    else if (path === '/api/ai/conversations/501') data = conversation
    else if (path === '/api/ai/plans') data = list(i => ({ ...plan, aiPlanId: String(i + 800) }))
    else if (path === '/api/ai/plans/801') data = plan
    else if (path === '/api/statistics/overview') data = { totalTrips: 3, totalTravelDays: 8, totalBudget: 5600, totalActualExpense: 115, ongoingTrips: 0, upcomingTrips: 3, finishedTrips: 0 }
    else if (path === '/api/statistics/expense-categories') data = { totalAmount: 115, items: [{ category: 'FOOD', name: '餐饮', amount: 65 }, { category: 'TRANSPORT', name: '交通', amount: 50 }] }
    else if (path === '/api/statistics/trip-costs' || path === '/api/statistics/budget-comparison') data = { items: [{ ...trip, remainingBudget: 1685, overBudget: false }] }
    else data = {}
    return route.fulfill({ json: { code: 0, message: 'success', data } })
  })
  return state
}

const field = (page: Page, label: string) => page.locator('.el-form-item').filter({ has: page.locator('.el-form-item__label').getByText(label, { exact: true }) })
async function shot(page: Page, name: string) { mkdirSync(screenshots, { recursive: true }); await page.screenshot({ path: `${screenshots}/${name}.png`, animations: 'disabled' }) }

test('AI 条件缺失时提示跟随字段，阻止创建请求', async ({ page }) => {
  const state = await setup(page); await page.goto('/ai')
  await page.getByRole('button', { name: '生成旅行方案', exact: true }).click()
  await expect(field(page, '目的地').locator('.el-form-item__error')).toContainText('目的地城市')
  await expect(field(page, '出行日期（1–15 天）').locator('.el-form-item__error')).toContainText('1–15天')
  expect(state.writes).toHaveLength(0)
  await shot(page, 'planner-field-errors')
})

test('AI 接口嵌套字段错误对应输入框，长提示不会覆盖下一行', async ({ page }) => {
  const state = await setup(page)
  state.fieldErrors = { 'conditions.destination': '该城市暂不支持规划，请清空关联旅行后选择其他目的地，已经填写的旅行想法会保留。', 'conditions.travelDays': '请选择连续1–15天的出行日期', 'conditions.preferences[0]': '这项偏好超过60字，请精简后重试' }
  await page.goto('/ai?tripId=1')
  await expect(page.getByPlaceholder('开始日期')).toHaveValue('2026-12-01')
  await page.getByRole('button', { name: '生成旅行方案', exact: true }).click()
  await expect(field(page, '目的地').locator('.el-form-item__error')).toContainText('该城市暂不支持规划')
  await expect(field(page, '出行日期（1–15 天）').locator('.el-form-item__error')).toContainText('1–15天')
  await expect(field(page, '旅行偏好（可选）').locator('.el-form-item__error')).toContainText('超过60字')
  const error = await field(page, '目的地').locator('.el-form-item__error').boundingBox()
  const next = await field(page, '本次总预算（元）').boundingBox()
  expect(next!.y).toBeGreaterThan(error!.y + error!.height)
  await shot(page, 'planner-server-field-errors')
})

test('活动时间错误显示在时间段下面，修正后正常应用', async ({ page }) => {
  await setup(page); await page.goto('/ai/chat/501')
  await page.getByRole('button', { name: '编辑：故宫博物院', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '编辑活动', exact: true })
  await dialog.getByPlaceholder('结束时间', { exact: true }).fill('08:00'); await dialog.getByPlaceholder('结束时间', { exact: true }).press('Tab')
  await dialog.getByRole('button', { name: '应用修改', exact: true }).click()
  const error = field(page, '活动时间').locator('.el-form-item__error')
  await expect(error).toContainText('结束时间不能早于开始时间')
  const bottom = await error.boundingBox(), control = await dialog.getByPlaceholder('结束时间', { exact: true }).boundingBox()
  expect(bottom!.y - control!.y - control!.height).toBeLessThan(20)
  await shot(page, 'activity-time-field-error')
  await dialog.getByPlaceholder('结束时间', { exact: true }).fill('11:30'); await dialog.getByPlaceholder('结束时间', { exact: true }).press('Tab')
  await dialog.getByRole('button', { name: '应用修改', exact: true }).click()
  await expect(dialog).not.toBeVisible(); await expect(page.locator('.timeline-time').first()).toContainText('11:30')
})

test('历史方案本地校验和服务端嵌套错误落到对应活动字段', async ({ page }) => {
  const state = await setup(page); await page.goto('/ai/result/801')
  const name = page.getByPlaceholder('活动名称（必填）').first()
  await name.fill('')
  await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
  await expect(page.locator('.item-name-field .el-form-item__error').first()).toContainText('请填写活动名称')
  expect(state.writes).toHaveLength(0)
  await name.fill('故宫博物院')
  state.saveErrors = { 'days[0].items[0].itemName': '这个活动名称有误，请核对景点名称后重试' }
  await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
  await expect(page.locator('.item-name-field .el-form-item__error').first()).toContainText('请核对景点名称')
  await expect(name).toHaveValue('故宫博物院')
})

for (const [name, url, ready] of [
  ['旅行列表', '/trips', '.el-table__body tbody tr'], ['景点探索', '/attractions', '.el-table__body tbody tr'],
  ['收藏列表', '/favorites', '.el-table__body tbody tr'], ['AI规划', '/ai', '.history-entry'],
  ['多轮聊天', '/ai/chat/501', '.activity-card'], ['历史方案', '/ai/result/801', '.item-editor'],
  ['个人中心', '/profile', '.profile-name'], ['统计图表', '/statistics', '.chart-box canvas']
]) test(`${name}实际正文与标题只使用三档字号`, async ({ page }) => {
  await setup(page); await page.goto(url!); await expect(page.locator(ready!).first()).toBeVisible()
  const fonts = await page.locator('body').evaluate(root => Array.from(new Set(Array.from(root.querySelectorAll('*')).filter(el => el instanceof HTMLElement && el.offsetWidth && el.offsetHeight && Array.from(el.childNodes).some(n => n.nodeType === 3 && n.textContent?.trim())).map(el => getComputedStyle(el).fontSize))))
  expect(fonts.filter(size => !['14px', '18px', '24px'].includes(size)), JSON.stringify(fonts)).toEqual([])
  await expect(page.locator('.page h1').first()).toHaveCSS('font-size', '24px')
  for (const title of await page.locator('.page h2').all()) await expect(title).toHaveCSS('font-size', '18px')
  if (url === '/statistics') {
    const canvasFonts = await page.evaluate(() => [...(window as any).__chartFonts] as string[])
    expect(canvasFonts.length).toBeGreaterThan(0)
    expect(canvasFonts.every(font => ['14', '18', '24'].includes(font.match(/(\d+(?:\.\d+)?)px/)?.[1] || '')), JSON.stringify(canvasFonts)).toBeTruthy()
    await shot(page, 'statistics-aligned-color')
  }
})

test('统计和预算的同排卡片顶边对齐', async ({ page }) => {
  await setup(page); await page.goto('/statistics'); await expect(page.locator('.chart-box canvas').first()).toBeVisible()
  const tops = await page.locator('.chart-grid > .tp-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().top))
  expect(Math.abs(tops[0]! - tops[1]!)).toBeLessThan(1)
  await page.goto('/trips/1'); await page.getByRole('tab', { name: '预算统计', exact: true }).click()
  await expect(page.locator('.budget-grid > .tp-card')).toHaveCount(2)
  const budgetTops = await page.locator('.budget-grid > .tp-card').evaluateAll(cards => cards.map(card => card.getBoundingClientRect().top))
  expect(Math.abs(budgetTops[0]! - budgetTops[1]!)).toBeLessThan(1)
  await shot(page, 'budget-aligned-color')
})

for (const [name, url, ready] of [['profile', '/profile', '.profile-name'], ['planner', '/ai', '.history-entry'], ['statistics', '/statistics', '.chart-box canvas'], ['chat', '/ai/chat/501', '.activity-card'], ['result', '/ai/result/801', '.item-editor']]) {
  test(`${name}窄屏卡片和表单控件保持在可见区域`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); await setup(page); await page.goto(url!); await expect(page.locator(ready!).first()).toBeVisible()
    const overflow = await page.locator('.page .tp-card, .page .el-input, .page .el-input-number, .page .el-select, .page .el-date-editor').evaluateAll(elements => elements.filter(el => el instanceof HTMLElement && el.offsetWidth && el.offsetHeight && !el.closest('.el-table')).map(el => ({ class: el.className, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right })).filter(el => el.left < 0 || el.right > window.innerWidth + 1))
    expect(overflow).toEqual([])
    await shot(page, `narrow-${name}`)
  })
}
