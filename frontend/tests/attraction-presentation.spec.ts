import { test, expect, type Page } from '@playwright/test'
import { mkdirSync } from 'node:fs'

test.setTimeout(45000)

// Controlled search results keep this visual check independent of AMap and API keys.
const museums = [
  ['重庆中国三峡博物馆', '渝中区', '人民路236号'],
  ['重庆开埠遗址公园', '南岸区', '马鞍山56号'],
  ['红岩革命历史博物馆', '渝中区', '红岩村52号'],
  ['重庆魔术博物馆', '渝中区', '鹅岭正街一号36-35栋'],
  ['重庆金融历史博物馆', '渝中区', '新华路74号（小什字地铁站4A口步行140米）'],
  ['重庆体育博物馆', '渝中区', '两路口街道体育路34号大田湾体育场内'],
  ['重庆建川博物馆聚落', '九龙坡区', '谢家湾街道鹤皋村1号（谢家湾地铁站1号口步行340米）'],
  ['飞虎队博物馆', '渝中区', '化龙桥街道嘉陵新路62号飞虎队博物馆'],
  ['王琦美术博物馆', '渝中区', '上清寺街道中山四路75号附60-67号'],
  ['166舰陈列馆', '九龙坡区', '万象大道与万象三路交叉口东250米']
].map(([name, district, address], i) => ({
  name, district, address, city: '重庆市', type: i === 1 ? '风景名胜;公园广场' : '科教文化服务;博物馆',
  longitude: 106.550513 + i / 1000, latitude: 29.562014
}))
const screenshots = 'test-results/attraction-presentation'
const ok = (data: unknown) => ({ code: 0, message: 'success', data })

async function search(page: Page, longText = false) {
  let writes = 0
  await page.addInitScript(() => {
    sessionStorage.setItem('accessToken', 'visual-check-token')
    sessionStorage.setItem('currentUser', JSON.stringify({ userId: '1', username: 'visual_check', nickname: '张同学' }))
  })
  await page.route(/^https?:\/\/[^/]+\/api\//, route => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() !== 'GET') writes++
    if (path === '/api/users/me') return route.fulfill({ json: ok({ userId: '1', username: 'visual_check', nickname: '张同学' }) })
    if (path === '/api/pois/search') return route.fulfill({ json: ok({
      source: 'AMAP_LIVE', page: 1, size: 10,
      list: longText ? [{ ...museums[0], name: '博物馆长名称和分馆信息'.repeat(8), address: '用于检查地址完整信息可查看且不会撑高卡片的详细地址'.repeat(8) }] : museums
    }) })
    return route.fulfill({ json: ok({ list: [], total: 0, page: 1, size: 20 }) })
  })
  await page.goto('/attractions')
  await page.getByPlaceholder('关键词，如：博物馆').fill('博物馆')
  await page.getByPlaceholder('选择省市').click()
  await page.locator('.el-cascader-panel:visible').getByText('重庆市', { exact: true }).click()
  await page.getByRole('button', { name: '搜索', exact: true }).click()
  await expect(page.locator('.poi-card')).toHaveCount(longText ? 1 : 10)
  return () => writes
}

test('搜索结果保留清晰的文字层级、紧凑卡片和录入预填', async ({ page }) => {
  await page.setViewportSize({ width: 1680, height: 1160 })
  const writes = await search(page)
  const first = page.locator('.poi-card').first()
  const metrics = await first.evaluate(card => {
    const size = (selector: string) => parseFloat(getComputedStyle(card.querySelector(selector)!).fontSize)
    return { name: size('.poi-card__name'), address: size('.poi-card__addr'), city: size('.poi-card__meta'), height: card.getBoundingClientRect().height }
  })
  expect(metrics.name).toBeGreaterThan(metrics.address)
  expect(metrics.city).toBeLessThanOrEqual(metrics.address)
  expect(metrics.height).toBeLessThan(300)
  await expect(page.locator('.section-desc').first()).toHaveCSS('font-size', '14px')
  const buttons = await page.locator('.poi-card__footer .el-button').evaluateAll(elements => elements.slice(0, 4).map(el => el.getBoundingClientRect().bottom))
  expect(Math.max(...buttons) - Math.min(...buttons)).toBeLessThan(2)
  mkdirSync(screenshots, { recursive: true })
  await page.screenshot({ path: `${screenshots}/desktop.png`, animations: 'disabled' })
  await first.getByRole('button', { name: /查看.*经纬度/ }).focus()
  await expect(page.getByRole('tooltip')).toContainText('106.550513, 29.562014')
  await first.getByRole('button', { name: '录入景点', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '新增自建景点', exact: true })
  await expect(dialog.getByPlaceholder('例如：李子坝观景平台')).toHaveValue(museums[0].name)
  await expect(dialog.locator('.el-cascader input')).toHaveValue('重庆市')
  await expect(dialog.getByPlaceholder('例如：观景 / 美食 / 博物馆')).toHaveValue('科教文化服务 / 博物馆')
  await expect(page.getByRole('tooltip')).not.toBeVisible()
  await page.screenshot({ path: `${screenshots}/prefill.png`, animations: 'disabled' })
  await dialog.getByRole('button', { name: '取消', exact: true }).click()
  expect(writes()).toBe(0)
})

test('窄屏下长名称和地址不会撑破卡片，搜索与录入仍可使用', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await search(page, true)
  const first = page.locator('.poi-card').first()
  const bounds = await first.boundingBox()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(bounds!.height).toBeLessThan(330)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  // A toolbar must keep its inputs usable rather than shrinking them to icons.
  expect((await page.getByPlaceholder('关键词，如：博物馆').boundingBox())!.width).toBeGreaterThan(150)
  expect((await page.locator('.poi-search__toolbar .el-cascader').boundingBox())!.width).toBeGreaterThan(150)
  const fullAddress = first.locator('.poi-card__addr span')
  expect((await fullAddress.getAttribute('title'))!.length).toBeGreaterThan(100)
  mkdirSync(screenshots, { recursive: true })
  await page.screenshot({ path: `${screenshots}/mobile.png`, fullPage: true, animations: 'disabled' })
  await first.getByRole('button', { name: '录入景点', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '新增自建景点', exact: true }).getByPlaceholder('例如：李子坝观景平台')).toHaveValue('博物馆长名称和分馆信息'.repeat(8))
})
