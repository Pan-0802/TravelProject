import {test,expect,type Page,type APIRequestContext,type Locator} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'

test.use({actionTimeout:15000})

async function fixture(page:Page,request:APIRequestContext){
  const username='schedule_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),password='Schedule@123456'
  let token=''
  async function api(method:string,path:string,body?:unknown){
    const response=await request.fetch('/api'+path,{method,data:body,headers:token?{Authorization:'Bearer '+token}:{}})
    const json=await response.json();expect(response.ok(),json.message).toBeTruthy();expect(json.code,json.message).toBe(0);return json.data
  }
  await api('POST','/auth/register',{username,password,confirmPassword:password,nickname:'时间归位验收'})
  const session=await api('POST','/auth/login',{username,password});token=session.accessToken
  await page.addInitScript(data=>{sessionStorage.setItem('accessToken',data.accessToken);sessionStorage.setItem('currentUser',JSON.stringify(data.user))},session)
  const trip=await api('POST','/trips',{title:'手工活动自动归位验收',destination:'北京',startDate:'2026-12-01',endDate:'2026-12-03',totalBudget:1200})
  await api('POST',`/trips/${trip.tripId}/expenses`,{category:'FOOD',amount:12,spentOn:'2026-12-01',description:'排序前已存在的测试消费'})
  const create=(itemName:string,startTime:string|null,endTime:string|null,date='2026-12-01')=>api('POST',`/trips/${trip.tripId}/days/${date}/items`,{itemName,startTime,endTime,sortOrder:999,estimatedCost:0})
  const days=()=>api('GET',`/trips/${trip.tripId}/days`)
  return {api,trip,create,days}
}

async function chooseTime(page:Page,input:Locator,value:string){
  await input.click()
  const panel=page.locator('.el-time-panel:visible')
  await expect(panel).toBeVisible()
  await input.fill(value);await input.press('Enter')
  await expect(input).toHaveValue(value)
  await expect(panel).not.toBeVisible()
}

async function expectOrder(card:Locator,names:string[]){
  const rows=card.locator('.item');await expect(rows).toHaveCount(names.length)
  for(let i=0;i<names.length;i++)await expect(rows.nth(i).locator('.item__name')).toContainText(names[i]!)
}

test('16点手工活动自动排入下午，改时间后归位，刷新和实际消费保持正确',async({page,request})=>{
  const f=await fixture(page,request)
  await f.create('早间活动','08:30','09:20');await f.create('北海公园','14:45','16:30');await f.create('晚餐','17:00','18:00');await f.create('什刹海夜景','18:15','19:45');await f.create('未定时间活动',null,null)
  await page.goto('/trips/'+f.trip.tripId)
  const card=page.locator('.day-card').first()
  await card.getByRole('button',{name:'添加行程',exact:true}).click()
  const editor=page.getByRole('dialog',{name:'添加行程（2026-12-01）',exact:true})
  await editor.getByPlaceholder('例如：解放碑步行游览').fill('壹条龙涮肉(台基厂店)')
  await chooseTime(page,editor.getByPlaceholder('开始时间',{exact:true}),'16:00')
  await expect(editor.getByPlaceholder('结束时间',{exact:true})).toHaveValue('')
  await editor.getByRole('spinbutton').fill('200');await editor.getByRole('spinbutton').press('Tab')
  await expect(editor.locator('.overlap-hint')).toContainText('北海公园')
  await editor.getByRole('button',{name:'保存',exact:true}).click()
  const expected=['早间活动','北海公园','壹条龙涮肉(台基厂店)','晚餐','什刹海夜景','未定时间活动']
  await expectOrder(card,expected)
  await expect(card.locator('.item').nth(2).locator('.item__time')).toContainText('16:00')
  await expect(card.locator('.item').nth(2).locator('.item__name')).toContainText('时间重叠')
  await page.reload();await expectOrder(page.locator('.day-card').first(),expected)
  mkdirSync('acceptance',{recursive:true});await page.locator('.day-card').first().screenshot({path:'acceptance/manual-time-placement-2026-11-25.png',animations:'disabled'})
  const before=(await f.days()).days[0].items
  const added=before.find((item:any)=>item.itemName==='壹条龙涮肉(台基厂店)')
  expect(added.sortOrder).toBe(3);expect(added.endTime).toBeNull();expect(added.sourceType).toBe('MANUAL')
  await page.locator('.day-card').first().locator('.item').nth(2).getByRole('button',{name:'编辑',exact:true}).click()
  const edit=page.getByRole('dialog',{name:'编辑行程项',exact:true})
  await chooseTime(page,edit.getByPlaceholder('开始时间',{exact:true}),'08:00')
  await edit.getByRole('button',{name:'保存',exact:true}).click()
  await expectOrder(page.locator('.day-card').first(),['壹条龙涮肉(台基厂店)','早间活动','北海公园','晚餐','什刹海夜景','未定时间活动'])
  const after=(await f.days()).days[0].items
  for(const original of before.filter((item:any)=>item.itemId!==added.itemId)){
    const current=after.find((item:any)=>item.itemId===original.itemId)
    expect([current.startTime,current.endTime,current.estimatedCost,current.sourceType]).toEqual([original.startTime,original.endTime,original.estimatedCost,original.sourceType])
  }
  expect((await f.api('GET',`/trips/${f.trip.tripId}/budget-summary`)).actualExpense).toBe(12)
  writeFileSync('acceptance/manual-time-placement-2026-11-25.json',JSON.stringify({syntheticAccountOnly:true,tripId:f.trip.tripId,insertedAt:'16:00',insertedSortOrder:3,editMovedTo:'08:00',refreshKeptOrder:true,originalTimesPreserved:true,unknownEndNotInvented:true,actualExpensePreserved:12},null,2))
})

test('景点探索选时间后自动插入所选日期，并带入建议游玩时长',async({page,request})=>{
  const f=await fixture(page,request)
  await f.create('第二天早间活动','09:00','10:00','2026-12-02');await f.create('第二天晚间活动','18:00','19:00','2026-12-02')
  const attraction=await f.api('POST','/attractions',{name:'自建景点_时间归位_'+f.trip.tripId,city:'北京',suggestedDurationMinutes:45,referenceTicketPrice:30})
  await page.goto('/attractions?tripId='+f.trip.tripId)
  await page.locator('.el-table__body tbody tr').filter({hasText:attraction.name}).getByRole('button',{name:'详情',exact:true}).click()
  await page.getByRole('dialog',{name:'景点详情',exact:true}).getByRole('button',{name:'加入旅行行程',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'把景点加入旅行',exact:true})
  await dialog.locator('.el-select').nth(1).click();await page.getByRole('option',{name:'2026-12-02',exact:true}).click()
  await chooseTime(page,dialog.getByPlaceholder('选择时间',{exact:true}),'11:00')
  await dialog.getByRole('button',{name:'加入并查看行程',exact:true}).click()
  await expect(page).toHaveURL(new RegExp('/trips/'+f.trip.tripId+'$'))
  await expectOrder(page.locator('.day-card').nth(1),['第二天早间活动',attraction.name,'第二天晚间活动'])
  const data=await f.days(),inserted=data.days[1].items[1]
  expect(inserted).toMatchObject({attractionId:attraction.attractionId,startTime:'11:00',endTime:'11:45',sortOrder:2,estimatedCost:30})
  expect(data.days[0].items).toHaveLength(0)
  expect((await f.api('GET',`/trips/${f.trip.tripId}/budget-summary`)).actualExpense).toBe(12)
})

test('已有末尾错序记录可以一次按时间整理，调整不改活动时间',async({page,request})=>{
  const f=await fixture(page,request)
  const morning=await f.create('上午活动','09:00','10:00'),night=await f.create('晚间活动','18:15','19:45'),manual=await f.create('旧版末尾16点活动','16:00',null)
  await f.api('PUT',`/trips/${f.trip.tripId}/days/2026-12-01/items/order`,{itemIds:[morning.itemId,night.itemId,manual.itemId]})
  const before=(await f.days()).days[0].items
  await page.goto('/trips/'+f.trip.tripId)
  const card=page.locator('.day-card').first()
  await expectOrder(card,['上午活动','晚间活动','旧版末尾16点活动'])
  await card.getByRole('button',{name:'按时间整理',exact:true}).click()
  await expectOrder(card,['上午活动','旧版末尾16点活动','晚间活动'])
  await expect(card.getByRole('button',{name:'按时间整理',exact:true})).toHaveCount(0)
  await page.reload();await expectOrder(page.locator('.day-card').first(),['上午活动','旧版末尾16点活动','晚间活动'])
  const after=(await f.days()).days[0].items
  for(const item of before)expect(after.find((row:any)=>row.itemId===item.itemId)).toMatchObject({itemName:item.itemName,startTime:item.startTime,endTime:item.endTime,sourceType:item.sourceType})
})
