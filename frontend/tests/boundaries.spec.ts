import { test, expect, type Page } from '@playwright/test'

// Controlled HTTP fixtures target client-side race/validation behavior; integration.spec uses live services.
const trip = (id: string, destination = '重庆') => ({ tripId: id, title: `旅行${id}`, destination,
  startDate: '2026-12-01', endDate: '2026-12-01', daysCount: 1, totalBudget: 1500, actualExpense: 0,
  tripStatus: 'NOT_STARTED', createdAt: '2026-11-23T10:00:00', updatedAt: '2026-11-23T10:00:00' })
const draft = { aiPlanId: '123456', tripId: '951', status: 'DRAFT', destination: '重庆',
  startDate: '2026-12-01', endDate: '2026-12-01', travelDays: 1, estimatedTotal: 100,
  createdAt: '2026-11-23T10:00:00', days: [{ date: '2026-12-01', dayNumber: 1, description: null,
    items: [{ itemName: '边界验收活动', startTime: null, endTime: null, sortOrder: 1, estimatedCost: 0, transportation: null, note: null }] }] }
const envelope = (data: unknown) => ({ code: 0, message: 'success', data })

async function session(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('accessToken', 'client-boundary-fixture')
    sessionStorage.setItem('currentUser', JSON.stringify({ userId: '1', username: 'boundary', nickname: '边界验收' }))
  })
  await page.route('**/api/users/me', r => r.fulfill({ json: envelope({ userId: '1', username: 'boundary', nickname: '边界验收' }) }))
  await page.route('**/api/attractions?*', r => r.fulfill({ json: envelope({ list: [], total: 0, page: 1, size: 50 }) }))
  await page.route('**/api/ai/plans?*', r => r.fulfill({ json: envelope({ list: [], total: 0, page: 1, size: 8 }) }))
  await page.route('**/api/ai/conversations?*', r => r.fulfill({ json: envelope({ list: [], total: 0, page: 1, size: 10 }) }))
}

test('选项超过50条仍能关联第51条旅行', async ({ page }) => {
  await session(page)
  const pages: number[] = []
  await page.route('**/api/trips?*', route => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'))
    pages.push(pageNumber)
    const list = Array.from({ length: 51 }, (_, i) => trip(String(901 + i))).slice((pageNumber - 1) * 50, pageNumber * 50)
    return route.fulfill({ json: envelope({ list, total: 51, page: pageNumber, size: 50 }) })
  })
  await page.goto('/ai?tripId=951')
  await expect(page.locator('.planner-page')).toContainText('旅行951')
  await expect(page.getByPlaceholder('开始日期')).toHaveValue('2026-12-01')
  expect(pages).toEqual([1, 2])
})

test('草稿已在其他窗口保存时409不会错误弹出覆盖确认', async ({ page }) => {
  await session(page)
  await page.route('**/api/trips?*', route => route.fulfill({ json: envelope({ list: [trip('951')], total: 1, page: 1, size: 50 }) }))
  let reads = 0
  await page.route('**/api/ai/plans/123456', route => route.fulfill({ json: envelope({ ...draft, status: ++reads === 1 ? 'DRAFT' : 'SAVED' }) }))
  await page.route('**/api/ai/plans/123456/save', route => route.fulfill({ status: 409, json: { code: 40900, message: '规划已保存，不能重复导入', data: null } }))
  await page.goto('/ai/result/123456')
  await expect(page.locator('.save-bar .el-select input')).toBeDisabled()
  await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
  await expect(page.getByRole('button', { name: '查看该旅行', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog', { name: '覆盖已有行程' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '确认保存到旅行', exact: true })).toHaveCount(0)
})

test('未绑定草稿选择不同目的地旅行时阻止提交', async ({ page }) => {
  await session(page)
  await page.route('**/api/trips?*', route => route.fulfill({ json: envelope({ list: [trip('952', '成都')], total: 1, page: 1, size: 50 }) }))
  await page.route('**/api/ai/plans/123456', route => route.fulfill({ json: envelope({ ...draft, tripId: null }) }))
  let submissions = 0
  await page.route('**/api/ai/plans/123456/save', route => { submissions++; return route.abort() })
  await page.goto('/ai/result/123456')
  await page.locator('.save-bar .el-select').click()
  await page.getByRole('option', { name: /旅行952/ }).click()
  await expect(page.getByText('所选旅行的目的地或起止日期与方案不一致，请选择匹配的旅行或重新生成方案。')).toBeVisible()
  await page.getByRole('button', { name: '确认保存到旅行', exact: true }).first().click()
  await expect(page.getByText('所选旅行目的地或日期与方案不一致，请更换旅行或重新生成方案', { exact: true })).toBeVisible()
  expect(submissions).toBe(0)
})
