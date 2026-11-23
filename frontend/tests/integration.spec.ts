import { test, expect, type Page, type APIRequestContext } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const password = 'Integration@123456'
let username = ''
let token = ''
let tripId = ''
let planId = ''
const requests: string[] = []

async function api(request: APIRequestContext, method: string, path: string, body?: unknown) {
  const result = await request.fetch(`/api${path}`, { method, data: body, headers: token ? { Authorization: `Bearer ${token}` } : {} })
  expect(result.ok(), `${method} ${path}: ${result.status()}`).toBeTruthy()
  const json = await result.json()
  expect(json.code).toBe(0)
  return json.data
}

async function login(page: Page) {
  await page.goto('/auth/login')
  await expect(page.getByText('Mock 演示模式', { exact: true })).toHaveCount(0)
  await page.getByPlaceholder('请输入用户名').fill(username)
  await page.getByPlaceholder('请输入密码', { exact: true }).fill(password)
  await page.getByRole('button', { name: '登录', exact: true }).click()
  await expect(page).toHaveURL(/\/trips$/)
}

test.describe.serial('真实前后端联调', () => {
  test.afterAll(() => {
    mkdirSync('test-results', { recursive: true })
    writeFileSync('test-results/live-context.json', JSON.stringify({ username, tripId, planId, requests }, null, 2))
  })
  test.beforeAll(async ({ request }) => {
    username = `ui_accept_${Date.now()}`
    await api(request, 'POST', '/auth/register', { username, password, confirmPassword: password, nickname: '页面联调验收' })
    const session = await api(request, 'POST', '/auth/login', { username, password })
    token = session.accessToken
  })

  test('登录、创建旅行、活动排序、消费预算与统计', async ({ page, request }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', r => { const path = new URL(r.url()).pathname; if (path.startsWith('/api/')) requests.push(r.method() + ' ' + path) })
    await login(page)
    await page.getByRole('button', { name: '新建旅行', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: /^(新建旅行|添加行程.*|记录消费)$/ })
    await dialog.getByPlaceholder('例如：重庆三日游').fill('页面联调验收旅行')
    await dialog.getByPlaceholder('例如：重庆', { exact: true }).fill('重庆')
    await dialog.getByPlaceholder('开始日期').fill('2026-12-01')
    await dialog.getByPlaceholder('结束日期').fill('2026-12-01')
    await dialog.getByPlaceholder('结束日期').press('Tab')
    await dialog.getByRole('spinbutton').fill('1500')
    const created = page.waitForResponse(r => r.url().endsWith('/api/trips') && r.request().method() === 'POST')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    tripId = (await (await created).json()).data.tripId
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: '详情', exact: true }).first().click()
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}$`))
    for (const name of ['验收活动甲', '验收活动乙']) {
      await page.getByRole('button', { name: '添加行程', exact: true }).first().click()
      await dialog.getByPlaceholder('例如：解放碑步行游览').fill(name)
      await dialog.getByRole('button', { name: '保存', exact: true }).click()
      await expect(dialog).not.toBeVisible()
      await expect(page.locator('.item__name').filter({ hasText: name })).toBeVisible()
    }
    await page.locator('button[title="上移"]').nth(1).click()
    await expect.poll(async () => (await api(request, 'GET', `/trips/${tripId}/days`)).days[0].items[0].itemName).toBe('验收活动乙')
    await page.getByRole('tab', { name: '消费记录' }).click()
    await page.getByRole('button', { name: '记录消费', exact: true }).click()
    await dialog.getByRole('spinbutton').fill('65')
    await dialog.getByPlaceholder('例如：午餐、地铁充值').fill('页面联调模拟消费')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    await expect(page.getByText('页面联调模拟消费', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: '预算统计' }).click()
    await expect(page.locator('.budget-panel')).toContainText('¥65.00')
    await expect(page.locator('.budget-panel canvas')).toBeVisible()
    await page.goto('/statistics')
    await expect(page.getByRole('heading', { name: '数据统计', exact: true })).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()
    await expect.poll(async () => (await api(request, 'GET', '/statistics/overview')).totalActualExpense).toBe(65)
    expect(errors).toEqual([])
  })

  test('自建景点、收藏与高德实时搜索', async ({ page }) => {
    await login(page)
    await page.goto('/attractions')
    await page.getByRole('button', { name: '新增自建景点', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: '新增自建景点', exact: true })
    await dialog.getByPlaceholder('例如：李子坝观景平台').fill('页面验收独立景点')
    await dialog.getByPlaceholder('例如：重庆', { exact: true }).fill('重庆')
    await dialog.getByRole('button', { name: '保存', exact: true }).click()
    await expect(dialog).not.toBeVisible()
    const card = page.locator('.attr-card').filter({ hasText: '页面验收独立景点' })
    await card.getByRole('button', { name: '收藏', exact: true }).click()
    await expect(card.getByRole('button', { name: '取消收藏', exact: true })).toBeVisible()
    await page.goto('/favorites')
    await expect(page.getByText('页面验收独立景点', { exact: true })).toBeVisible()
    await page.goto('/attractions')
    await page.getByPlaceholder('关键词，如：博物馆').fill('公园')
    await page.getByPlaceholder('城市，如：重庆市').fill('重庆市')
    const response = page.waitForResponse(r => r.url().includes('/api/pois/search'))
    await page.getByRole('button', { name: '搜索', exact: true }).click()
    const body = await (await response).json()
    expect(body.code).toBe(0)
    expect(body.data.source).toBe('AMAP_LIVE')
    await expect(page.locator('.poi-card').first()).toBeVisible()
  })

  test('真实AI生成、编辑、覆盖确认、保存与费用隔离', async ({ page, request }) => {
    await login(page)
    await page.goto(`/ai?tripId=${tripId}`)
    // 对话式流程：自动选中该旅行 → 交通方式 → 预算 → 偏好 → 附加要求 → 生成
    await page.locator('.chat-chips .el-check-tag', { hasText: '公共交通' }).first().click()
    await page.locator('.chat-chips .el-check-tag').first().click()
    await page.getByRole('button', { name: '确定' }).click()
    await page.getByPlaceholder(/还有什么要求/).fill('仅安排2个活动，用于课程联调验收。')
    await page.getByRole('button', { name: '确定' }).click()
    const generated = page.waitForResponse(r => r.url().endsWith('/api/ai/plans') && r.request().method() === 'POST', { timeout: 95000 })
    await page.getByRole('button', { name: '开始生成方案' }).click()
    const body = await (await generated).json()
    expect(body.code, body.message).toBe(0)
    planId = body.data.aiPlanId
    await expect(page.locator('.plan-table')).toBeVisible()
    await page.getByRole('button', { name: '编辑并保存行程' }).click()
    await expect(page).toHaveURL(new RegExp(`/ai/result/${planId}$`))
    await expect(page.getByPlaceholder('活动名称（必填）').first()).toBeVisible()
    await page.getByPlaceholder('活动名称（必填）').first().fill('AI验收编辑后的活动')
    await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
    await expect(page.getByRole('dialog', { name: '覆盖已有行程' })).toBeVisible()
    await page.getByRole('button', { name: '取消', exact: true }).last().click()
    expect((await api(request, 'GET', `/ai/plans/${planId}`)).status).toBe('DRAFT')
    await expect(page.getByPlaceholder('活动名称（必填）').first()).toHaveValue('AI验收编辑后的活动')
    await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
    await page.getByRole('button', { name: '覆盖保存', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/trips/${tripId}$`))
    await expect(page.locator('.item__name').filter({ hasText: 'AI验收编辑后的活动' })).toBeVisible()
    const formal = await api(request, 'GET', `/trips/${tripId}/days`)
    expect(formal.days[0].items.every((i: { sourceType: string }) => i.sourceType === 'AI')).toBe(true)
    expect((await api(request, 'GET', `/trips/${tripId}/budget-summary`)).actualExpense).toBe(65)
    await page.goto(`/ai/result/${planId}`)
    await expect(page.getByRole('button', { name: '查看该旅行', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '确认保存到旅行', exact: true })).toHaveCount(0)
  })

  test('登录错误提示与过期令牌跳转', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByPlaceholder('请输入用户名').fill(username)
    await page.getByPlaceholder('请输入密码', { exact: true }).fill('wrong-password')
    await page.getByRole('button', { name: '登录', exact: true }).click()
    await expect(page.getByText('账号或密码错误', { exact: true })).toBeVisible()
    await expect(page.getByText('登录状态已失效，请重新登录', { exact: true })).toHaveCount(0)
    await login(page)
    await page.evaluate(() => sessionStorage.setItem('accessToken', 'expired.invalid.token'))
    await page.goto('/profile')
    await expect(page).toHaveURL(/\/auth\/login/)
  })
})
