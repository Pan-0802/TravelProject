import {test,expect} from '@playwright/test'
import {mkdirSync,writeFileSync} from 'node:fs'

test('真实三轮对话：生成、解释、参考编辑调整，再确认保存并恢复历史',async({page,request})=>{
 test.skip(process.env.RUN_LIVE_AI!=='true','设置 RUN_LIVE_AI=true 后才调用付费模型')
 test.setTimeout(300000)
 const username='chat_live_'+Date.now(),password='ChatLive@123456'
 async function api(method:string,path:string,body?:unknown,token?:string){const response=await request.fetch('/api'+path,{method,data:body,headers:token?{Authorization:'Bearer '+token}:{}});const json=await response.json();expect(response.ok(),json.message).toBeTruthy();expect(json.code,json.message).toBe(0);return json.data}
 await api('POST','/auth/register',{username,password,confirmPassword:password,nickname:'多轮真实验收'})
 const session=await api('POST','/auth/login',{username,password}),token=session.accessToken
 const trip=await api('POST','/trips',{title:'真实多轮对话验收',destination:'北京市',startDate:'2026-12-10',endDate:'2026-12-10',totalBudget:800},token)
 await api('POST',`/trips/${trip.tripId}/expenses`,{category:'FOOD',amount:27,spentOn:'2026-12-10',description:'多轮验收保留的原消费'},token)
 await api('POST',`/trips/${trip.tripId}/days/2026-12-10/items`,{itemName:'原有人工安排',sortOrder:1,estimatedCost:0},token)
 const chat=await api('POST','/ai/conversations',{conditions:{tripId:trip.tripId,destination:'北京市',startDate:'2026-12-10',endDate:'2026-12-10',travelDays:1,totalBudget:800,transportation:'公共交通',preferences:['轻松'],requirements:'带老人，少走路。仅安排2个可检索的具体景点，留足交通和休息时间。'}},token)

 async function waitForConversation(id:string){
  let latest:any
  await expect.poll(async()=>{latest=await api('GET','/ai/conversations/'+id,undefined,token);return latest.processing},{timeout:120000,intervals:[500,1000,2500]}).toBe(false)
  expect(latest.messages.some((m:any)=>m.status==='FAILED')).toBe(false)
  return latest
 }
 await page.addInitScript(data=>{sessionStorage.setItem('accessToken',data.accessToken);sessionStorage.setItem('currentUser',JSON.stringify(data.user))},session)
 const firstReply=page.waitForResponse(r=>r.url().endsWith(`/conversations/${chat.conversationId}/messages/submit`)&&r.request().method()==='POST',{timeout:95000})
 await page.goto(`/ai/chat/${chat.conversationId}?start=1`)
 const initialResponse=await firstReply,initialResult=await initialResponse.json()
 expect(initialResponse.ok(),initialResult.message).toBeTruthy()
 const first=await waitForConversation(chat.conversationId)
 expect(first.currentPlan.status).toBe('DRAFT')
 const firstPlanId=first.currentPlan.aiPlanId
 await expect(page.getByPlaceholder(/例如：我带着老人/)).toBeEnabled()
 const mode=page.locator('.composer-toolbar .el-select'),input=page.getByPlaceholder(/例如：我带着老人/)
 await mode.click();await page.getByRole('option',{name:'只问问题',exact:true}).click()
 await input.fill('为什么这份行程适合带老人？只解释原因，不修改方案。')
 const askReply=page.waitForResponse(r=>r.url().endsWith(`/conversations/${chat.conversationId}/messages/submit`)&&r.request().method()==='POST',{timeout:95000})
 await page.getByRole('button',{name:'发送消息',exact:true}).click()
 await askReply
 const second=await waitForConversation(chat.conversationId)
 expect(second.currentPlan.aiPlanId).toBe(firstPlanId);expect(second.messages).toHaveLength(4)
 await page.getByRole('button',{name:/^编辑：/}).first().click()
 const activityEditor=page.getByRole('dialog',{name:'编辑活动',exact:true})
 await activityEditor.getByPlaceholder('预约、休息或你的补充说明').fill('用户补充：这一站之后休息20分钟')
 await activityEditor.getByRole('button',{name:'应用修改',exact:true}).click()
 await mode.click();await page.getByRole('option',{name:'调整方案',exact:true}).click()
 await input.fill('参考我编辑的休息备注，仍保留2个景点，安排更轻松些，并说明改动。')
 const revisedReply=page.waitForResponse(r=>r.url().endsWith(`/conversations/${chat.conversationId}/messages/submit`)&&r.request().method()==='POST',{timeout:95000})
 await page.getByRole('button',{name:'发送消息',exact:true}).click()
 const revisedResponse=await revisedReply,revised=await waitForConversation(chat.conversationId)
 expect(revised.currentPlan.aiPlanId).not.toBe(firstPlanId);expect(revised.messages).toHaveLength(6)
 expect(revisedResponse.request().postDataJSON().currentDays[0].items[0].note).toContain('休息20分钟')
 await expect(page.getByRole('button',{name:'确认保存到旅行',exact:true})).toBeEnabled()
 mkdirSync('acceptance',{recursive:true});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'acceptance/chat-live-2026-11-27.png',fullPage:true,animations:'disabled'})
 await page.getByRole('button',{name:'确认保存到旅行',exact:true}).click()
 const confirm=page.getByRole('dialog',{name:'覆盖已有行程',exact:true})
 await expect(confirm).toBeVisible();await confirm.getByRole('button',{name:'取消',exact:true}).click()
 expect((await api('GET',`/trips/${trip.tripId}/days`,undefined,token)).days[0].items[0].itemName).toBe('原有人工安排')
 await page.getByRole('button',{name:'确认保存到旅行',exact:true}).click();await confirm.getByRole('button',{name:'覆盖保存',exact:true}).click()
 await expect(page.getByRole('button',{name:'查看正式旅行',exact:true})).toBeVisible()
 expect((await api('GET',`/trips/${trip.tripId}/budget-summary`,undefined,token)).actualExpense).toBe(27)
 await page.reload();await expect(page.locator('.chat-message')).toHaveCount(6)
 writeFileSync('acceptance/chat-live-2026-11-27.json',JSON.stringify({username,conversationId:chat.conversationId,tripId:trip.tripId,firstPlanId,latestPlanId:revised.currentPlan.aiPlanId,turns:3,messageCount:6,questionKeptPlan:true,editedDaysSent:true,savedAfterConfirmation:true,actualExpensePreserved:27,historyRestored:true},null,2))
})
