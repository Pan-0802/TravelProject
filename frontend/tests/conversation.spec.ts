import {test,expect,type Page} from '@playwright/test'
import {mkdirSync} from 'node:fs'
test.use({actionTimeout:15000})
const trip={tripId:'701',title:'北京亲子游',destination:'北京',startDate:'2026-12-01',endDate:'2026-12-01',totalBudget:1800,daysCount:1,actualExpense:0,tripStatus:'NOT_STARTED'}
const conditions={tripId:'701',destination:'北京',startDate:trip.startDate,endDate:trip.endDate,travelDays:1,totalBudget:1800,transportation:'公共交通',requirements:'带老人，少走路',preferences:[]}
const days=[{date:trip.startDate,dayNumber:1,description:'市区漫游',items:[{itemName:'故宫博物院',startTime:'09:00',endTime:'11:00',sortOrder:1,transportation:'公共交通',estimatedCost:60,note:null},{itemName:'天坛公园',startTime:'12:00',endTime:'14:00',sortOrder:2,transportation:'公共交通',estimatedCost:30,note:null}]}]
const plan={aiPlanId:'801',tripId:'701',status:'DRAFT',destination:'北京',startDate:trip.startDate,endDate:trip.endDate,travelDays:1,estimatedTotal:90,days,request:conditions,createdAt:'2026-11-25T12:00:00'}
const envelope=(data:unknown)=>({code:0,message:'success',data})
type Fixture={state:any;posts:any[];created?:any;fail:boolean;delay:number}
async function setup(page:Page,empty=false):Promise<Fixture>{
 const f:Fixture={state:{conversationId:'501',title:'北京 · 1天旅行',version:empty?0:2,processing:false,conditions,currentPlan:empty?null:structuredClone(plan),currentDays:empty?null:structuredClone(days),memory:empty?'':'带老人，少走路',createdAt:'2026-11-25T12:00:00',updatedAt:'2026-11-25T12:00:00',messages:empty?[]:[{messageId:'1',requestId:'previous-turn',role:'user',content:'生成北京旅行方案',status:'COMPLETED',planId:null},{messageId:'2',requestId:'previous-turn',role:'assistant',content:'已安排一份轻松的行程。',status:'COMPLETED',planId:'801'}]},posts:[],fail:false,delay:0}
 await page.addInitScript(()=>{sessionStorage.setItem('accessToken','conversation-ui-fixture');sessionStorage.setItem('currentUser',JSON.stringify({userId:'1',username:'conversation',nickname:'对话验收'}))})
 await page.route(/^http:\/\/localhost:\d+\/api\//,async r=>{
  const path=new URL(r.request().url()).pathname,method=r.request().method(),body=method==='GET'?null:r.request().postDataJSON()
  let data:any
  if(path==='/api/users/me')data={userId:'1',username:'conversation',nickname:'对话验收'}
  else if(path==='/api/trips')data={list:[trip],total:1,page:1,size:50}
  else if(path==='/api/attractions')data={list:[],total:0,page:1,size:50}
  else if(path==='/api/ai/plans')data={list:[],total:0,page:1,size:8}
  else if(path==='/api/ai/conversations'&&method==='GET')data={list:[f.state],total:1,page:1,size:10}
  else if(path==='/api/ai/conversations'&&method==='POST'){f.created=body;data=f.state}
  else if(path==='/api/ai/conversations/501'&&method==='GET')data=f.state
  else if(path==='/api/ai/conversations/501/draft') {f.state.currentDays=body.days;f.state.version++;data=f.state}
  else if(path==='/api/ai/plans/801/save'){f.state.currentPlan.status='SAVED';data={tripId:'701',status:'SAVED',savedDays:1,savedItems:2}}
  else if(path==='/api/ai/plans/801')data=f.state.currentPlan
  else if(path==='/api/ai/conversations/501/messages/submit'){
   f.posts.push(body)
   if(body.expectedVersion!==f.state.version)return r.fulfill({status:409,json:{code:40900,message:'会话已在其他窗口更新',data:null}})
   f.state.version++;f.state.processing=true
   const user={messageId:String(f.state.messages.length+1),requestId:body.requestId,role:'user',content:body.content,status:'PENDING',planId:null,errorMessage:null}
   f.state.messages.push(user)
   if(body.currentDays)f.state.currentDays=body.currentDays
   if(f.delay)await new Promise(resolve=>setTimeout(resolve,f.delay))
   f.state.processing=false;f.state.version++
   if(f.fail){user.status='FAILED';user.errorMessage='AI 暂时不可用';return r.fulfill({status:503,json:{code:50300,message:'AI 暂时不可用',data:null}})}
   user.status='COMPLETED'
   const revise=body.intent==='REVISE'||body.content.includes('调整')
   if(revise){const revised=structuredClone(body.currentDays||f.state.currentDays||days);f.state.currentPlan={...structuredClone(plan),aiPlanId:'801',days:revised};f.state.currentDays=revised}
   f.state.messages.push({messageId:String(f.state.messages.length+1),requestId:body.requestId,role:'assistant',content:revise?'我参考当前安排调整了行程。':'因为地点相邻，可以减少走路，已保留原来的方案。',status:'COMPLETED',planId:revise?'801':null,errorMessage:null})
   data=f.state
  } else return r.fulfill({status:404,json:{code:40400,message:'测试未提供此接口',data:null}})
  return r.fulfill({json:envelope(data)})
 })
 return f
}
const composer=(page:Page)=>page.getByPlaceholder(/例如：我带着老人/)
async function submit(page:Page,text:string){await composer(page).fill(text);await page.getByRole('button',{name:'发送消息',exact:true}).click()}
test('连续问答保留方案与消息，刷新后恢复聊天记录',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await submit(page,'为什么这样安排？')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.state.currentPlan.aiPlanId).toBe('801')
 await submit(page,'老人还能多休息吗？')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(3)
 await page.reload()
 await expect(page.locator('.chat-message')).toHaveCount(6)
 expect(f.posts).toHaveLength(2)
 mkdirSync('acceptance',{recursive:true});await page.screenshot({path:'acceptance/conversation-workspace.png',fullPage:true,animations:'disabled'})
})
test('编辑后的行程随下一轮发送，草稿单独保存不调用模型',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await editActivity(page,'故宫博物院','用户调整的故宫活动')
 await page.getByRole('button',{name:'保存草稿编辑',exact:true}).click()
 expect(f.posts).toHaveLength(0)
 await page.reload();await expect(page.locator('.activity-card h4').first()).toHaveText('用户调整的故宫活动')
 await submit(page,'为什么这样安排')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].currentDays[0].items[0].itemName).toBe('用户调整的故宫活动')
})
test('失败消息保留，手动重试使用新请求标识',async({page})=>{
 const f=await setup(page);f.fail=true;await page.goto('/ai/chat/501')
 await submit(page,'解释一下这条路线')
 await expect(page.locator('.message-failed')).toContainText('AI 暂时不可用')
 expect(f.state.currentPlan.aiPlanId).toBe('801')
 f.fail=false;await page.getByRole('button',{name:'重试这条消息',exact:true}).click()
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts).toHaveLength(2);expect(f.posts[0].requestId).not.toBe(f.posts[1].requestId)
 await expect(page.locator('.chat-bubble').filter({hasText:'解释一下这条路线'})).toHaveCount(1)
})

test('HTTP回复未到时可主动同步完成状态，解除等待且不重复发送',async({page})=>{
 const f=await setup(page);let release:()=>void=()=>{}
 await page.route('**/api/ai/conversations/501/messages/submit',async r=>{
  const body=r.request().postDataJSON();f.posts.push(body);f.state.version+=2
  f.state.messages.push({messageId:'3',requestId:body.requestId,role:'user',content:body.content,status:'COMPLETED',planId:null},{messageId:'4',requestId:body.requestId,role:'assistant',content:'状态查询已经拿到完成的回答',status:'COMPLETED',planId:null})
  await new Promise<void>(resolve=>{release=resolve});await r.fulfill({json:envelope(f.state)})
 })
 await page.goto('/ai/chat/501');await submit(page,'查询这次回复是否完成')
 await expect(page.getByRole('button',{name:'查询发送状态',exact:true})).toBeEnabled()
 await page.getByRole('button',{name:'查询发送状态',exact:true}).click()
 await expect(page.getByText('状态查询已经拿到完成的回答',{exact:true})).toBeVisible()
 await expect(composer(page)).toBeEnabled();await expect(page.locator('.thinking')).toHaveCount(0)
 expect(f.posts).toHaveLength(1);release()
})

test('消息未被服务器接受时，查询状态不会丢失手工编辑',async({page})=>{
 await setup(page)
 await page.route('**/api/ai/conversations/501/messages/submit',r=>r.abort('failed'),{times:1})
 await page.goto('/ai/chat/501')
 await editActivity(page,'故宫博物院','手工改过的具体景点')
 await submit(page,'帮我保留这些修改')
 await expect(page.locator('.conversation-error')).toContainText('无法连接')
 await page.getByRole('button',{name:'刷新会话',exact:true}).click()
 await expect(page.locator('.activity-card h4').first()).toHaveText('手工改过的具体景点')
 await expect(composer(page)).toHaveValue('帮我保留这些修改')
})
test('刷新处理中会话只查询状态，不重复发送付费消息',async({page})=>{
 const f=await setup(page);f.delay=700;await page.goto('/ai/chat/501')
 await submit(page,'为什么先去故宫')
 await expect.poll(()=>f.state.processing).toBe(true)
 await page.reload()
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts).toHaveLength(1)
})
test('只问问题的模式明确传给后端',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await page.locator('.composer-toolbar .el-select').click()
 await page.getByRole('option',{name:'只问问题',exact:true}).click()
 await submit(page,'解释安排')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].intent).toBe('ASK')
})
test('从条件页创建会话，首轮仅自动发送一次',async({page})=>{
 const f=await setup(page,true);await page.goto('/ai?tripId=701')
 await page.getByRole('button',{name:'生成旅行方案',exact:true}).click()
 await expect(page).toHaveURL(/\/ai\/chat\/501$/)
 await expect(page.locator('.chat-message--assistant')).toHaveCount(1)
 expect(f.posts).toHaveLength(1);expect(f.posts[0].requestId).toBe('initial-501');expect(f.created.conditions).toMatchObject({tripId:'701',destination:'北京',totalBudget:1800})
 await page.reload();await expect(page.locator('.chat-message')).toHaveCount(2);expect(f.posts).toHaveLength(1)
})
test('确认保存后可继续聊天，已保存版本禁止直接编辑',async({page})=>{
 await setup(page);await page.goto('/ai/chat/501')
 await page.getByRole('button',{name:'确认保存到旅行',exact:true}).click()
 await expect(page.getByRole('button',{name:'查看正式旅行',exact:true})).toBeVisible()
 await expect(page.getByRole('button',{name:/^编辑：/})).toHaveCount(0)
 await submit(page,'为什么这样安排')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
})
test('窄屏会话输入和方案预览可操作',async({page})=>{
 await page.setViewportSize({width:390,height:844});await setup(page);await page.goto('/ai/chat/501')
 await expect(composer(page)).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1)
})
test('网络未送达后改变问答模式，重发采用新的完整请求',async({page})=>{
 const f=await setup(page);let lost:any
 await page.route('**/api/ai/conversations/501/messages/submit',r=>{lost=r.request().postDataJSON();return r.abort('failed')},{times:1})
 await page.goto('/ai/chat/501');await submit(page,'为什么这样安排')
 await expect(page.locator('.conversation-error')).toContainText('无法连接')
 await page.locator('.composer-toolbar .el-select').click();await page.getByRole('option',{name:'只问问题',exact:true}).click()
 await page.getByRole('button',{name:'发送消息',exact:true}).click()
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].intent).toBe('ASK');expect(f.posts[0].requestId).not.toBe(lost.requestId)
})

async function editActivity(page:Page,original:string,name:string){
 await page.getByRole('button',{name:'编辑：'+original,exact:true}).click()
 const editor=page.getByRole('dialog',{name:'编辑活动',exact:true})
 await editor.getByPlaceholder('填写景点、餐饮或其他安排').fill(name)
 await editor.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(editor).not.toBeVisible()
}
function multipleDays(f:Fixture){
 f.state.title='北京 · 4天旅行'
 const many=Array.from({length:4},(_,i)=>({date:'2026-12-0'+(i+1),dayNumber:i+1,description:['老城漫游','博物馆与公园','胡同小吃','湖边散步'][i],items:structuredClone(days[0].items).map((item,j)=>({...item,itemName:i?'第'+(i+1)+'天景点'+(j+1):item.itemName}))}))
 f.state.conditions={...conditions,endDate:'2026-12-04',travelDays:4}
 f.state.currentPlan={...f.state.currentPlan,endDate:'2026-12-04',travelDays:4,days:many}
 f.state.currentDays=many
}

test('四天方案默认只展示当天时间线，日期可键盘切换，页面不再堆叠表单',async({page})=>{
 const f=await setup(page);multipleDays(f)
 const paths:string[]=[];page.on('request',r=>{if(/\/api\/pois\/routes?$/.test(r.url()))paths.push(r.url())})
 await page.goto('/ai/chat/501')
 await expect(page.getByRole('tab')).toHaveCount(4)
 await expect(page.locator('.activity-card')).toHaveCount(2)
 await expect(page.locator('.plan-workspace input:visible')).toHaveCount(0)
 await expect(page.getByText('景点之间怎么走',{exact:true})).toHaveCount(0)
 await page.getByRole('tab',{name:/第 2 天/}).click()
 await expect(page.locator('.activity-card h4').first()).toHaveText('第2天景点1')
 await page.getByRole('tab',{selected:true}).press('ArrowRight')
 await expect(page.getByRole('tab',{selected:true})).toContainText('第 3 天')
 expect(paths).toEqual([])
 mkdirSync('acceptance',{recursive:true});await page.screenshot({path:'acceptance/ai-conversation-simple.png',fullPage:true,animations:'disabled'})
})

test('编辑弹窗取消不影响草稿，时间错误可修正再应用',async({page})=>{
 await setup(page);await page.goto('/ai/chat/501')
 await page.getByRole('button',{name:'编辑：故宫博物院',exact:true}).click()
 const editor=page.getByRole('dialog',{name:'编辑活动',exact:true})
 await editor.getByPlaceholder('填写景点、餐饮或其他安排').fill('尚未应用的名字')
 await editor.getByRole('button',{name:'取消',exact:true}).click()
 await expect(page.locator('.activity-card h4').first()).toHaveText('故宫博物院')
 await page.getByRole('button',{name:'编辑：故宫博物院',exact:true}).click()
 await editor.getByPlaceholder('结束时间',{exact:true}).fill('08:00');await editor.getByPlaceholder('结束时间',{exact:true}).press('Tab')
 await editor.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(editor.getByRole('alert')).toContainText('结束时间不能早于开始时间')
 await editor.getByPlaceholder('结束时间',{exact:true}).fill('10:30');await editor.getByPlaceholder('结束时间',{exact:true}).press('Tab')
 await editor.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(editor).not.toBeVisible();await expect(page.locator('.timeline-time').first()).toContainText('10:30')
})

test('调整顺序、删除和撤销保持活动完整，发送包含最新顺序',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await page.getByRole('button',{name:'更多操作：故宫博物院',exact:true}).click();await page.getByRole('menu',{name:'更多操作：故宫博物院',exact:true}).getByRole('menuitem',{name:'下移',exact:true}).click()
 await expect(page.getByRole('menu',{name:'更多操作：故宫博物院',exact:true})).not.toBeVisible()
 await expect(page.locator('.activity-card h4').first()).toHaveText('天坛公园')
 await page.getByRole('button',{name:'更多操作：故宫博物院',exact:true}).click();await page.getByRole('menu',{name:'更多操作：故宫博物院',exact:true}).getByRole('menuitem',{name:'移除活动',exact:true}).click()
 await expect(page.locator('.activity-card')).toHaveCount(1)
 await page.getByRole('button',{name:'撤销上次修改',exact:true}).click();await expect(page.locator('.activity-card')).toHaveCount(2)
 await submit(page,'请解释当前顺序')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].currentDays[0].items.map((item:any)=>[item.itemName,item.sortOrder])).toEqual([['天坛公园',1],['故宫博物院',2]])
})

test('添加活动即时更新费用，应用前不写入实际消费',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await page.getByRole('button',{name:'添加活动',exact:true}).click()
 const editor=page.getByRole('dialog',{name:'添加活动',exact:true})
 await editor.getByPlaceholder('填写景点、餐饮或其他安排').fill('午餐：在前门周边自行选择')
 await editor.getByRole('spinbutton').fill('25');await editor.getByRole('spinbutton').press('Tab')
 await editor.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(page.locator('.activity-card')).toHaveCount(3)
 await expect(page.locator('.itinerary-overview')).toContainText('¥115.00')
 expect(f.posts).toHaveLength(0)
})

test('从第二天发起调整会带入日期和完整方案，点击发送前不调用模型',async({page})=>{
 const f=await setup(page);multipleDays(f);await page.goto('/ai/chat/501')
 await page.getByRole('tab',{name:/第 2 天/}).click()
 await page.getByRole('button',{name:'让 AI 调整这一天',exact:true}).click()
 await expect(composer(page)).toHaveValue(/第 2 天（2026-12-02）/)
 expect(f.posts).toHaveLength(0)
 await composer(page).fill((await composer(page).inputValue())+'少走路，多休息')
 await page.getByRole('button',{name:'发送消息',exact:true}).click()
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].intent).toBe('REVISE');expect(f.posts[0].currentDays).toHaveLength(4)
})


test('编辑过关联景点后新增活动，不会把旧关联带给新活动',async({page})=>{
 const f=await setup(page);f.state.currentDays[0].items[0].attractionId='901'
 await page.goto('/ai/chat/501');await editActivity(page,'故宫博物院','已关联的故宫活动')
 await page.getByRole('button',{name:'添加活动',exact:true}).click()
 const editor=page.getByRole('dialog',{name:'添加活动',exact:true})
 await editor.getByPlaceholder('填写景点、餐饮或其他安排').fill('自由休息')
 await editor.getByRole('button',{name:'应用修改',exact:true}).click()
 await submit(page,'解释这份安排')
 await expect(page.locator('.chat-message--assistant')).toHaveCount(2)
 expect(f.posts[0].currentDays[0].items[0].attractionId).toBe('901')
 expect(f.posts[0].currentDays[0].items[2].attractionId).toBeNull()
})


test('切换会话不会带入上一趟旅行的保存目标或未发送消息',async({page})=>{
 const f=await setup(page)
 const other=structuredClone(f.state);other.conversationId='602';other.title='重庆 · 1天旅行';other.conditions={...other.conditions,destination:'重庆',tripId:null};other.currentPlan={...other.currentPlan,tripId:null,destination:'重庆'}
 await page.route('**/api/ai/conversations/602',r=>r.fulfill({json:envelope(other)}))
 await page.goto('/ai/chat/501');await composer(page).fill('仅属于北京的未发送要求')
 await page.evaluate(()=>{window.history.pushState({},'', '/ai/chat/602');window.dispatchEvent(new PopStateEvent('popstate'))})
 await expect(page.getByRole('heading',{name:'重庆 · 1天旅行',exact:true})).toBeVisible()
 await expect(composer(page)).toHaveValue('')
 await page.getByRole('button',{name:'确认保存到旅行',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'保存到旅行',exact:true})).toBeVisible()
 await expect(page.getByRole('dialog',{name:'保存到旅行',exact:true}).getByRole('button',{name:'确认保存到旅行',exact:true})).toBeDisabled()
})

test('请求已完成但本地仍留有发送缓存时，恢复会话不会重填已发消息',async({page})=>{
 await setup(page)
 await page.addInitScript(()=>sessionStorage.setItem('chat-edit:501',JSON.stringify({planId:'801',version:2,input:'生成北京旅行方案',request:{requestId:'previous-turn',expectedVersion:0,content:'生成北京旅行方案',intent:'REVISE',currentDays:null}})))
 await page.goto('/ai/chat/501')
 await expect(page.locator('.chat-message')).toHaveCount(2)
 await expect(composer(page)).toHaveValue('')
})


test('重庆七项活动按天显示，长备注不会挤走日期与保存按钮',async({page})=>{
 const f=await setup(page)
 const names=['观音桥好吃街','北仓文创街区','午餐：观音桥周边自行选择','江北嘴中央公园','重庆大剧院','晚餐：江北嘴周边自行选择','千厮门大桥']
 const many=Array.from({length:3},(_,i)=>({date:'2026-12-'+(10+i),dayNumber:i+1,description:i?'慢慢逛，给旅行留一点空白':'从观音桥漫游到江北嘴，傍晚看看江景',items:names.map((name,j)=>({itemName:i?'第'+(i+1)+'天自由安排'+(j+1):name,startTime:String(9+j).padStart(2,'0')+':00',endTime:String(9+j).padStart(2,'0')+':45',sortOrder:j+1,transportation:j?'公共交通':null,estimatedCost:/午餐|晚餐/.test(name)?60:0,note:j===2?'在观音桥商圈自行选择餐厅，优先考虑重庆小面、火锅等。具体门店与营业情况可按当日偏好决定，给用餐和休息留足时间。':'按自己的节奏游玩，累了可以找地方坐坐；当天的时间可随时调整。'}))}))
 f.state.messages[0].content='生成重庆三天旅行方案';f.state.messages[1].content='已安排观音桥与江北嘴一带的漫游，可以按天查看和调整。'
 f.state.title='重庆 · 3天旅行';f.state.conditions={...conditions,destination:'重庆',startDate:'2026-12-10',endDate:'2026-12-12',travelDays:3}
 f.state.currentDays=many;f.state.currentPlan={...f.state.currentPlan,destination:'重庆',startDate:'2026-12-10',endDate:'2026-12-12',travelDays:3,days:many}
 await page.route(/^http:\/\/localhost:\d+\/api\/trips(?:\?.*)?$/,r=>r.fulfill({json:envelope({list:[{...trip,title:'重庆轻松三日游',destination:'重庆',startDate:'2026-12-10',endDate:'2026-12-12'}],total:1,page:1,size:50})}))
 await page.goto('/ai/chat/501')
 await expect(page.getByRole('tab')).toHaveCount(3);await expect(page.locator('.activity-card')).toHaveCount(7)
 await expect(page.locator('.plan-workspace input:visible')).toHaveCount(0)
 await page.locator('.activity-card').last().scrollIntoViewIfNeeded()
 expect(await page.locator('.day-content').evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
 await expect(page.getByRole('tab',{selected:true})).toBeVisible()
 await expect(page.getByRole('button',{name:'确认保存到旅行',exact:true})).toBeVisible()
 await page.locator('.day-content').evaluate(el=>{el.scrollTop=0})
 mkdirSync('acceptance',{recursive:true});await page.screenshot({path:'acceptance/ai-chongqing-redesign.png',fullPage:true,animations:'disabled'})
 await page.setViewportSize({width:390,height:844})
 await expect(page.locator('.layout__aside')).toHaveCSS('width','64px')
 expect(await page.locator('.conversation-page').evaluate(el=>el.clientWidth)).toBeGreaterThan(300)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1)
 await page.getByRole('button',{name:'编辑：观音桥好吃街',exact:true}).click()
 await expect(page.getByRole('dialog',{name:'编辑活动',exact:true})).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth)).toBeLessThanOrEqual(1)
 await page.screenshot({path:'acceptance/ai-activity-editor-mobile.png',fullPage:false,animations:'disabled'})
})


test('手工添加和修改时间会自动归位，冲突只提示不移动原活动',async({page})=>{
 const f=await setup(page);await page.goto('/ai/chat/501')
 await page.getByRole('button',{name:'添加活动',exact:true}).click()
 const add=page.getByRole('dialog',{name:'添加活动',exact:true})
 await add.getByPlaceholder('填写景点、餐饮或其他安排').fill('手工补充餐饮')
 await add.getByPlaceholder('开始时间',{exact:true}).click();await expect(page.locator('.el-time-panel:visible')).toBeVisible()
 await add.getByPlaceholder('开始时间',{exact:true}).fill('10:30');await add.getByPlaceholder('开始时间',{exact:true}).press('Enter')
 await expect(page.locator('.el-time-panel:visible')).toHaveCount(0)
 await expect(add.getByPlaceholder('结束时间',{exact:true})).toHaveValue('')
 await expect(add.locator('.edit-overlap-hint')).toContainText('故宫博物院')
 await add.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(page.locator('.activity-card h4')).toHaveText(['故宫博物院','手工补充餐饮','天坛公园'])
 await expect(page.locator('.overlap-label')).toHaveCount(2)
 await page.getByRole('button',{name:'编辑：手工补充餐饮',exact:true}).click()
 const edit=page.getByRole('dialog',{name:'编辑活动',exact:true})
 await edit.getByPlaceholder('开始时间',{exact:true}).click();await expect(page.locator('.el-time-panel:visible')).toBeVisible()
 await edit.getByPlaceholder('开始时间',{exact:true}).fill('08:00');await edit.getByPlaceholder('开始时间',{exact:true}).press('Enter')
 await expect(page.locator('.el-time-panel:visible')).toHaveCount(0)
 await edit.getByRole('button',{name:'应用修改',exact:true}).click()
 await expect(page.locator('.activity-card h4')).toHaveText(['手工补充餐饮','故宫博物院','天坛公园'])
 await expect(page.locator('.overlap-label')).toHaveCount(0)
 await page.getByRole('button',{name:'保存草稿编辑',exact:true}).click()
 await expect.poll(()=>f.state.currentDays[0].items.map((item:any)=>item.startTime)).toEqual(['08:00','09:00','12:00'])
 expect(f.state.currentDays[0].items.map((item:any)=>item.sortOrder)).toEqual([1,2,3])
 expect(f.state.currentDays[0].items[1].endTime).toBe('11:00')
 await page.reload();await expect(page.locator('.activity-card h4').first()).toHaveText('手工补充餐饮')
})
