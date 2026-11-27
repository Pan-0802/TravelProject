import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'

// Only a new account and synthetic December itinerary are sent to external services.
test('真实四天方案：连续增景点和美食、按天浏览、问答与保存',async({page,request})=>{
 test.skip(process.env.RUN_LIVE_AI!=='true','设置 RUN_LIVE_AI=true 后才调用付费模型')
 test.setTimeout(480000)
 const username='four_day_'+Date.now(),password='FourDay@123456'
 async function api(method:string,path:string,body?:unknown,token?:string){const response=await request.fetch('/api'+path,{method,data:body,timeout:100000,headers:token?{Authorization:'Bearer '+token}:{}});const json=await response.json();expect(response.ok(),json.message).toBeTruthy();expect(json.code,json.message).toBe(0);return json.data}
 await api('POST','/auth/register',{username,password,confirmPassword:password,nickname:'四天合成场景验收'})
 const session=await api('POST','/auth/login',{username,password}),token=session.accessToken
 const publicStops=['天坛公园','前门大街','大栅栏商业街','杨梅竹斜街']
 const trip=await api('POST','/trips',{title:'四天多景点与美食验收',destination:'北京',startDate:'2026-12-10',endDate:'2026-12-13',totalBudget:2200},token)
 await api('POST',`/trips/${trip.tripId}/expenses`,{category:'FOOD',amount:31,spentOn:'2026-12-10',description:'合成验收原消费'},token)
 const conditions={tripId:trip.tripId,destination:'北京',startDate:'2026-12-10',endDate:'2026-12-13',travelDays:4,totalBudget:2200,transportation:'公共交通',preferences:['美食','城市漫游'],requirements:'合成验收：四天北京旅行，每天不超过6项，地点尽量顺路。'}
 const sourceDays=[publicStops,['故宫博物院','景山公园','北海公园','什刹海历史文化街区'],['雍和宫','孔庙和国子监博物馆','五道营胡同','地坛公园'],['圆明园遗址公园','颐和园']].map((names,i)=>({date:`2026-12-${10+i}`,dayNumber:i+1,description:'合成的公开地点安排',items:names.map((itemName,j)=>({itemName,startTime:`${String(9+j*2).padStart(2,'0')}:00`,endTime:`${String(10+j*2).padStart(2,'0')}:00`,sortOrder:j+1,transportation:'公共交通',estimatedCost:0,note:null}))}))
 let chat=await api('POST','/ai/conversations',{conditions,currentDays:sourceDays},token)
 async function send(content:string,intent:string){chat=await api('POST',`/ai/conversations/${chat.conversationId}/messages`,{requestId:crypto.randomUUID(),expectedVersion:chat.version,content,intent},token);expect(chat.processing).toBe(false);return chat}
 await send('请在这份四天公开景点安排基础上生成完整方案，保留全部14个景点，补充合理时间和费用，每天不超过6项。','REVISE')
 expect(chat.currentDays).toHaveLength(4)
 const firstPlanId=chat.currentPlan.aiPlanId,firstCount=chat.currentDays.reduce((n:number,d:any)=>n+d.items.length,0)

 async function waitForConversation(id:string){
  let latest:any
  await expect.poll(async()=>{latest=await api('GET','/ai/conversations/'+id,undefined,token);return latest.processing},{timeout:120000,intervals:[500,1000,2500]}).toBe(false)
  expect(latest.messages.some((m:any)=>m.status==='FAILED')).toBe(false)
  return latest
 }
 await page.addInitScript(data=>{sessionStorage.setItem('accessToken',data.accessToken);sessionStorage.setItem('currentUser',JSON.stringify(data.user))},session)
 await page.goto(`/ai/chat/${chat.conversationId}`)
 await page.getByPlaceholder(/例如：我带着老人/).fill('可以稍微增加一点点景点，并且多一点美食。保留现有四天景点，每天最多增加2项，餐饮使用具体餐馆或美食街名称。')
 const reply=page.waitForResponse(r=>r.url().endsWith(`/conversations/${chat.conversationId}/messages/submit`)&&r.request().method()==='POST',{timeout:100000})
 await page.getByRole('button',{name:'发送消息',exact:true}).click()
 const response=await reply,result=await response.json();expect(response.ok(),result.message).toBeTruthy();chat=await waitForConversation(chat.conversationId)
 expect(chat.currentDays).toHaveLength(4);expect(chat.currentPlan.aiPlanId).not.toBe(firstPlanId)
 const nextCount=chat.currentDays.reduce((n:number,d:any)=>n+d.items.length,0);expect(nextCount).toBeGreaterThan(firstCount)
 await expect(page.locator('.message-failed')).toHaveCount(0);await expect(page.getByPlaceholder(/例如：我带着老人/)).toBeEnabled()
 const revisedPlanId=chat.currentPlan.aiPlanId
 await send('请简短解释增加的餐饮安排，不修改方案。','ASK')
 expect(chat.currentPlan.aiPlanId).toBe(revisedPlanId);expect(chat.messages).toHaveLength(6)
 await page.reload();await expect(page.locator('.chat-message')).toHaveCount(6)
 await expect(page.getByRole('tab')).toHaveCount(4)
 await expect(page.locator('.activity-card')).toHaveCount(chat.currentDays[0].items.length)
 await page.getByRole('tab',{name:/第 2 天/}).click()
 await expect(page.locator('.activity-card h4').first()).toHaveText(chat.currentDays[1].items[0].itemName)
 await expect(page.locator('.plan-workspace input:visible')).toHaveCount(0)
 await expect(page.getByRole('button',{name:/核验路程|选择地点/})).toHaveCount(0)
 await page.getByRole('button',{name:'确认保存到旅行',exact:true}).click();await expect(page.getByRole('button',{name:'查看正式旅行',exact:true})).toBeVisible()
 expect((await api('GET',`/trips/${trip.tripId}/budget-summary`,undefined,token)).actualExpense).toBe(31)
 const saved=await api('GET',`/trips/${trip.tripId}/days`,undefined,token);expect(saved.days).toHaveLength(4)
 expect(saved.days.reduce((n:number,d:any)=>n+d.items.length,0)).toBe(nextCount)
 mkdirSync('acceptance',{recursive:true});await page.screenshot({path:'acceptance/four-day-chat-2026-11-27.png',fullPage:true,animations:'disabled'})
 writeFileSync('acceptance/four-day-live-2026-11-27.json',JSON.stringify({syntheticDataOnly:true,conversationId:chat.conversationId,tripId:trip.tripId,turns:3,firstCount,nextCount,days:4,distanceModuleRemoved:true,compactDayView:true,questionKeptPlan:true,savedDays:saved.days.length,actualExpensePreserved:31,parseErrors:0},null,2))
})
