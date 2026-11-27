import {test,expect,type Page} from '@playwright/test'

// Controlled provider responses verify the UI and request contract, without billable AI calls.
const trip={tripId:'701',title:'重庆周末',destination:'重庆',startDate:'2026-12-01',endDate:'2026-12-01',daysCount:1,totalBudget:1800,actualExpense:0,tripStatus:'NOT_STARTED'}
const attraction={attractionId:'901',name:'洪崖洞民俗风貌区',city:'重庆',category:'景点',referenceTicketPrice:0,suggestedDurationMinutes:60,isOwner:true,isFavorited:false,description:null}
const plan={aiPlanId:'801',tripId:'701',status:'DRAFT',destination:'重庆',startDate:trip.startDate,endDate:trip.endDate,travelDays:1,estimatedTotal:160,createdAt:'2026-11-23T20:00:00',
 request:{tripId:'701',destination:'重庆',startDate:trip.startDate,endDate:trip.endDate,travelDays:1,totalBudget:1800,transportation:'公共交通',preferences:[],requirements:'少走路'},
 days:[{date:trip.startDate,dayNumber:1,description:'城市漫游',items:[{itemName:'解放碑步行街',startTime:'09:00',endTime:'10:00',sortOrder:1,estimatedCost:60,transportation:'公共交通',note:null},{itemName:'洪崖洞民俗风貌区',startTime:'10:10',endTime:'11:30',sortOrder:2,estimatedCost:100,transportation:'公共交通',note:null}]}]}
const envelope=(data:unknown)=>({code:0,message:'success',data})
async function setup(page:Page,unbound=false){
 await page.addInitScript(()=>{sessionStorage.setItem('accessToken','planning-ux-fixture');sessionStorage.setItem('currentUser',JSON.stringify({userId:'1',username:'ux',nickname:'体验验收'}))})
 await page.route(/^http:\/\/localhost:\d+\/api\//,async route=>{
  const path=new URL(route.request().url()).pathname,method=route.request().method()
  let data:unknown
  if(path==='/api/users/me')data={userId:'1',username:'ux',nickname:'体验验收'}
  else if(path==='/api/trips'&&method==='GET')data={list:unbound?[]:[trip],total:unbound?0:1,page:1,size:50}
  else if(path==='/api/trips/701')data=trip
  else if(path==='/api/trips/701/days')data={tripId:'701',startDate:trip.startDate,endDate:trip.endDate,days:[{...plan.days[0],items:plan.days[0]!.items.map((i,k)=>({...i,itemId:String(k+1),dayId:'1',sourceType:'AI'}))}]}
  else if(path==='/api/trips/701/budget-summary')data={totalBudget:1800,actualExpense:0,remainingBudget:1800,overBudget:false,byCategory:[]}
  else if(path==='/api/attractions')data={list:[attraction],total:1,page:1,size:50}
  else if(path==='/api/ai/plans'&&method==='GET')data={list:[],total:0,page:1,size:8}
  else if(path==='/api/ai/conversations'&&method==='GET')data={list:[],total:0,page:1,size:10}
  else if(path==='/api/ai/plans/801')data={...plan,tripId:unbound?null:'701'}
  else return route.fulfill({status:404,json:{code:40400,message:'测试未提供此响应',data:null}})
  return route.fulfill({json:envelope(data)})
 })
}
test('新方案直接创建匹配旅行，不用离开编辑页重填日期',async({page})=>{
 await setup(page,true)
 let payload:any
 await page.route('**/api/trips',r=>{payload=r.request().postDataJSON();return r.fulfill({status:201,json:envelope(trip)})})
 await page.goto('/ai/result/801')
 await page.getByRole('button',{name:'按此方案创建旅行',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'新建旅行',exact:true})
 await expect(dialog.getByPlaceholder('开始日期')).toHaveValue(trip.startDate)
 await expect(dialog.getByPlaceholder('例如：重庆三日游')).toHaveValue('重庆旅行')
 await dialog.getByRole('button',{name:'保存',exact:true}).click()
 expect(payload).toMatchObject({destination:'重庆',startDate:trip.startDate,endDate:trip.endDate,totalBudget:1800})
 await expect(page).toHaveURL(/\/ai\/result\/801$/)
})
test('从行程记消费自动带日期和活动名，金额须手填',async({page})=>{
 await setup(page)
 await page.goto('/trips/701')
 await page.getByRole('button',{name:'记消费',exact:true}).first().click()
 const dialog=page.getByRole('dialog',{name:'记录消费',exact:true})
 await expect(dialog.getByPlaceholder('例如：午餐、地铁充值')).toHaveValue('解放碑步行街')
 await expect(dialog.getByRole('spinbutton')).toHaveValue('')
 await dialog.getByRole('button',{name:'保存',exact:true}).click()
 await expect(dialog.getByText('金额必须大于 0')).toBeVisible()
})
test('景点直接加入旅行时自动关联景点，无需再填名称',async({page})=>{
 await setup(page)
 let payload:any
 await page.route('**/api/trips/701/days/*/items',r=>{payload=r.request().postDataJSON();return r.fulfill({status:201,json:envelope({...payload,itemId:'new'})})})
 await page.goto('/attractions?tripId=701')
 await page.locator('.el-table__body tbody tr').getByRole('button',{name:'详情',exact:true}).click()
 await page.getByRole('dialog',{name:'景点详情',exact:true}).getByRole('button',{name:'加入旅行行程',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'把景点加入旅行',exact:true})
 await expect(dialog).toContainText('洪崖洞民俗风貌区')
 await dialog.getByRole('button',{name:'加入并查看行程',exact:true}).click()
 await expect(page).toHaveURL(/\/trips\/701$/)
 expect(payload).toMatchObject({attractionId:'901',itemName:attraction.name,sortOrder:3,estimatedCost:0})
})
test('调整要求失败保留编辑，成功后切换到新草稿',async({page})=>{
 await setup(page)
 let calls=0,payload:any
 await page.route('**/api/ai/conversations',r=>{payload=r.request().postDataJSON().conditions;return r.fulfill(++calls===1?{status:503,json:{code:50300,message:'AI 暂时不可用',data:null}}:{json:envelope({conversationId:'802'})})})
 await page.route('**/api/ai/plans/802',r=>r.fulfill({json:envelope({...plan,aiPlanId:'802'})}))
 await page.goto('/ai/result/801')
 await page.getByPlaceholder('活动名称（必填）').first().fill('我手工调整的活动')
 await page.getByPlaceholder(/例如：第二天太赶/).fill('减少一个景点，多休息')
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'按新要求生成另一版',exact:true}).click()
  await page.getByRole('dialog',{name:'生成另一版',exact:true}).getByRole('button',{name:'确定',exact:true}).click()
  if(i===0){await expect(page.getByText(/AI 暂时不可用，当前方案和修改已保留/)).toBeVisible();await expect(page.getByPlaceholder('活动名称（必填）').first()).toHaveValue('我手工调整的活动')}
 }
 await expect(page).toHaveURL(/\/ai\/chat\/802/)
 expect(payload.requirements).toContain('减少一个景点，多休息')
 expect(payload.referenceDays[0].items[0].itemName).toBe('我手工调整的活动')
 expect(payload.tripId).toBe('701')
})
test('窄屏规划表可操作，不产生横向溢出',async({page})=>{
 await page.setViewportSize({width:390,height:844})
 await setup(page)
 await page.goto('/ai?tripId=701')
 await expect(page.getByRole('button',{name:'生成旅行方案',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1)
 await page.goto('/ai/result/801')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1)
})

test('距离核验入口从聊天、方案和正式行程全部移除，不发送路径请求',async({page})=>{
 await setup(page)
 const routeCalls:string[]=[]
 page.on('request',r=>{if(/\/api\/pois\/routes?$/.test(r.url()))routeCalls.push(r.url())})
 for(const path of ['/ai/result/801','/trips/701']){
  await page.goto(path)
  await expect(page.getByText('景点之间怎么走',{exact:true})).toHaveCount(0)
  await expect(page.getByRole('button',{name:/核验路程|选择地点|重试未完成路段/})).toHaveCount(0)
 }
 expect(routeCalls).toEqual([])
})
