import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const poi = {
  name: '叉一号老北京铜锅涮肉（用于验证长名称正常横排的分店）',
  city: '北京市', district: '东城区', address: '验收地址', type: '餐饮服务;中餐厅;火锅店;餐饮服务;中餐厅;火锅店',
  longitude: 116.41, latitude: 39.9
}

async function search(page: import('@playwright/test').Page) {
  await page.route('**/api/pois/search?*', route => route.fulfill({ json: {
    code: 0, message: 'success', data: { source: 'AMAP_LIVE', page: 1, size: 10, list: [poi,
      { ...poi, name: '第二个地点', city: null, type: null }] }
  } }))
  await page.goto('/attractions')
  await page.getByPlaceholder('关键词，如：博物馆').fill('美食')
  await page.getByPlaceholder('选择省市').click()
  await page.locator('.el-cascader-panel:visible').getByText('北京市',{exact:true}).click()
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.poi-card')).toHaveCount(2)
}

test.beforeEach(async ({ page, request }) => {
  const username = `poi_accept_${Date.now()}`
  const password = 'PoiAccept@123456'
  const registered = await request.post('/api/auth/register', { data: { username, password, confirmPassword: password } })
  expect(registered.status()).toBe(201)
  const result = await (await request.post('/api/auth/login', { data: { username, password } })).json()
  expect(result.code).toBe(0)
  await page.addInitScript(session => {
    sessionStorage.setItem('accessToken', session.accessToken)
    sessionStorage.setItem('currentUser', JSON.stringify(session.user))
  }, result.data)
})

test('点击录入预填基础字段、取消不保存、换结果和手工新增不残留旧值', async ({ page }) => {
  let writes = 0
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/attractions') writes++ })
  await search(page)
  mkdirSync('acceptance', { recursive: true })
  await page.screenshot({ path: 'acceptance/poi-search-layout.png', fullPage: true, animations: 'disabled' })
  const first = page.locator('.poi-card').first()
  const widths = await first.evaluate(element => ({ card: element.clientWidth, title: element.querySelector('.poi-card__name')!.clientWidth }))
  expect(widths.title).toBeGreaterThan(widths.card * 0.75)
  await first.getByRole('button', { name: '录入景点', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增自建景点', exact: true })
  await expect(dialog.getByPlaceholder('例如：李子坝观景平台')).toHaveValue(poi.name)
  await expect(dialog.locator('.el-cascader input').first()).toHaveValue('北京市')
  await expect(dialog.getByPlaceholder('例如：观景 / 美食 / 博物馆')).toHaveValue('餐饮服务 / 中餐厅 / 火锅店')
  await page.screenshot({ path: 'acceptance/poi-prefill-dialog.png', animations: 'disabled' })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.locator('.poi-card').nth(1).getByRole('button', { name: '录入景点', exact: true }).click()
  await expect(dialog.getByPlaceholder('例如：李子坝观景平台')).toHaveValue('第二个地点')
  await expect(dialog.locator('.el-cascader input').first()).toHaveValue('')
  await expect(dialog.getByPlaceholder('例如：观景 / 美食 / 博物馆')).toHaveValue('')
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  await page.getByRole('button', { name: '新增自建景点', exact: true }).click()
  await expect(dialog.getByPlaceholder('例如：李子坝观景平台')).toHaveValue('')
  expect(writes).toBe(0)
})

test('预填后确认写入真实后端，保存结果可在每日行程中关联', async ({ page, request }) => {
  const confirmedName = `已确认的预填景点_${Date.now()}`
  await search(page)
  await page.locator('.poi-card').first().getByRole('button', { name: '录入景点', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增自建景点', exact: true })
  await dialog.getByPlaceholder('例如：李子坝观景平台').fill(confirmedName)
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/attractions' && r.request().method() === 'POST')
  await dialog.getByRole('button', { name: '保存', exact: true }).click()
  const response = await saved
  expect(response.status()).toBe(201)
  const payload = response.request().postDataJSON()
  expect(payload).toMatchObject({ name: confirmedName, city: '北京市', category: '餐饮服务 / 中餐厅 / 火锅店', referenceTicketPrice: null })
  expect(payload).not.toHaveProperty('longitude')
  expect(payload).not.toHaveProperty('address')
  const attraction = (await response.json()).data
  await expect(page.locator('.el-table__body tbody tr').filter({ hasText: confirmedName })).toBeVisible()
  const token = await page.evaluate(() => sessionStorage.getItem('accessToken'))
  const headers = { Authorization: `Bearer ${token}` }
  const tripResponse = await request.post('/api/trips', { headers, data: { title: '预填关联验收旅行', destination: '北京市', startDate: '2026-12-01', endDate: '2026-12-01', totalBudget: 500 } })
  const trip = (await tripResponse.json()).data
  await page.goto(`/trips/${trip.tripId}`)
  await page.getByRole('button', { name: '添加行程', exact: true }).click()
  const itemDialog = page.getByRole('dialog', { name: /添加行程/ })
  await itemDialog.getByPlaceholder('例如：解放碑步行游览').fill('预填景点游览')
  await itemDialog.locator('.el-select').first().click()
  await page.getByRole('option', { name: new RegExp(confirmedName) }).click()
  const created = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/items'))
  await itemDialog.getByRole('button', { name: '保存', exact: true }).click()
  expect((await (await created).json()).data.attractionId).toBe(attraction.attractionId)
  await expect(page.locator('.item__name').filter({ hasText: confirmedName })).toBeVisible()
})
