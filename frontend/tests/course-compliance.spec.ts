import {test,expect,type Page} from '@playwright/test'
import {mkdirSync} from 'node:fs'

const screenshots='test-results/course-compliance-screenshots'
const trip=(id=1)=>({tripId:String(id),title:'规范验收旅行'+id,destination:'北京',startDate:'2026-12-01',endDate:'2026-12-03',daysCount:3,totalBudget:1500,actualExpense:65,tripStatus:'NOT_STARTED',createdAt:'2026-11-27T10:00:00'})
const ok=(data:unknown)=>({code:0,message:'success',data})
type State={mode:'normal'|'empty'|'error'|'slow'|'long';queries:URLSearchParams[];writes:number}
async function setup(page:Page):Promise<State>{
  const state:State={mode:'normal',queries:[],writes:0}
  await page.addInitScript(()=>{sessionStorage.setItem('accessToken','course-test-token');sessionStorage.setItem('currentUser',JSON.stringify({userId:'9001',username:'course_test',nickname:'规范验收账户'}))})
  await page.route(/^https?:\/\/[^/]+\/api\//,async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname
    if(path==='/api/users/me')return route.fulfill({json:ok({userId:'9001',username:'course_test',nickname:'规范验收账户',createdAt:'2026-11-27T10:00:00'})})
    if(path==='/api/trips'&&request.method()==='GET'){
      state.queries.push(url.searchParams)
      if(state.mode==='error')return route.fulfill({status:503,json:{code:50300,message:'暂时无法读取旅行，请重试',data:null}})
      if(state.mode==='slow'){await new Promise(resolve=>setTimeout(resolve,3600));try{await route.fulfill({json:ok({list:[],total:0,page:1,size:20})})}catch{};return}
      const pageNumber=Number(url.searchParams.get('page')||1)
      const rows=state.mode==='empty'?[]:Array.from({length:pageNumber===1?20:1},(_,i)=>({...trip(i+1),title:state.mode==='long'?'很长的旅行名称用于验证省略和悬浮全文'.repeat(8):trip(i+1).title}))
      return route.fulfill({json:ok({list:rows,total:rows.length?21:0,page:pageNumber,size:20})})
    }
    if(path==='/api/trips'&&request.method()==='POST'){state.writes++;await new Promise(resolve=>setTimeout(resolve,200));return route.fulfill({status:201,json:ok(trip(99))})}
    if(/^\/api\/trips\/\d+$/.test(path)){
      if(request.method()==='PATCH')return route.fulfill({status:422,json:{code:42200,message:'已有行程超出新日期范围，请调整日期',data:{fieldErrors:{startDate:'请扩大日期范围以包含现有行程',endDate:'请扩大日期范围以包含现有行程'}}}})
      return route.fulfill({json:ok(trip(Number(path.split('/').at(-1))))})
    }
    if(path.endsWith('/days'))return route.fulfill({json:ok({tripId:'1',days:[]})})
    if(path.endsWith('/budget-summary'))return route.fulfill({json:ok({tripId:'1',totalBudget:1500,actualExpense:65,remainingBudget:1435,overBudget:false,categoryBreakdown:[],expenseByCategory:[]})})
    if(path==='/api/favorites')return route.fulfill({json:ok({list:[],total:0,page:1,size:20})})
    return route.fulfill({json:ok({list:[],total:0,page:1,size:20})})
  })
  return state
}
async function shot(page:Page,name:string){mkdirSync(screenshots,{recursive:true});await page.screenshot({path:`${screenshots}/${name}.png`,fullPage:false,animations:'disabled'})}

test('列表20条、范围、数字日期对齐、只读行操作与筛选翻页',async({page})=>{
  const state=await setup(page);await page.goto('/trips')
  await expect(page.locator('.el-table__body tbody tr')).toHaveCount(20)
  await expect(page.locator('.list-pagination')).toContainText('第 1–20 条，共 21 条')
  const row=page.locator('.el-table__body tbody tr').first()
  await expect(row.getByRole('button')).toHaveText(['详情'])
  await expect(row.locator('td').nth(2)).toHaveCSS('text-align','right')
  await expect(row.locator('td').nth(3)).toHaveCSS('text-align','right')
  await page.getByPlaceholder('搜索旅行名称 / 目的地').fill('规范')
  await page.getByPlaceholder('搜索旅行名称 / 目的地').press('Enter')
  await page.getByRole('listitem',{name:'第 2 页',exact:true}).click()
  await expect.poll(()=>state.queries.at(-1)?.get('page')).toBe('2')
  expect(state.queries.at(-1)?.get('size')).toBe('20')
  expect(state.queries.at(-1)?.get('keyword')).toBe('规范')
  await expect(page.locator('.list-pagination')).toContainText('第 21–21 条，共 21 条')
})

test('四态之空态可清空条件并恢复查询',async({page})=>{
  const state=await setup(page);state.mode='empty';await page.goto('/trips')
  await page.getByPlaceholder('搜索旅行名称 / 目的地').fill('不存在的目的地')
  await page.getByRole('button',{name:'查询',exact:true}).click()
  await expect(page.locator('.el-empty')).toContainText('没有匹配的记录')
  await shot(page,'02-空态')
  state.mode='normal';await page.getByRole('button',{name:'清空条件',exact:true}).click()
  await expect(page.locator('.el-table__body tbody tr')).toHaveCount(20)
  await expect(page.getByPlaceholder('搜索旅行名称 / 目的地')).toHaveValue('')
})

test('四态之错误态持续显示并能重试，不冒充空数据',async({page})=>{
  const state=await setup(page);state.mode='error';await page.goto('/trips')
  await expect(page.locator('.request-error')).toContainText('暂时无法读取旅行')
  await page.waitForTimeout(3500)
  await expect(page.locator('.request-error')).toBeVisible()
  await expect(page.locator('.el-empty')).toHaveCount(0)
  await shot(page,'03-错误态')
  state.mode='normal';await page.getByRole('button',{name:'重试',exact:true}).click()
  await expect(page.locator('.el-table__body tbody tr')).toHaveCount(20)
})

test('四态之加载态及3秒超时可恢复',async({page})=>{
  const state=await setup(page);state.mode='slow';await page.goto('/trips')
  await expect(page.locator('.el-loading-mask')).toBeVisible()
  await shot(page,'01-加载态')
  await expect(page.locator('.request-error')).toContainText('超过 3 秒')
  state.mode='normal';await page.getByRole('button',{name:'重试',exact:true}).click()
  await expect(page.locator('.el-table__body tbody tr')).toHaveCount(20)
})

test('长文本省略悬浮且页面只使用三档字体',async({page})=>{
  const state=await setup(page);state.mode='long';await page.goto('/trips')
  const cell=page.locator('.el-table__body tbody tr').first().locator('.cell').first()
  await expect(cell).toHaveCSS('text-overflow','ellipsis')
  await cell.hover();await expect(page.getByRole('tooltip')).toContainText('很长的旅行名称')
  const fonts=await page.locator('body').evaluate(root=>Array.from(new Set(Array.from(root.querySelectorAll('*')).filter(el=>el instanceof HTMLElement&&el.offsetWidth&&el.offsetHeight&&Array.from(el.childNodes).some(n=>n.nodeType===3&&n.textContent?.trim())).map(el=>getComputedStyle(el).fontSize))))
  expect(fonts.every(size=>['14px','18px','24px'].includes(size)),JSON.stringify(fonts)).toBeTruthy()
  await shot(page,'05-列表规范')
})

test('必填和服务端日期校验显示在对应字段下方',async({page})=>{
  await setup(page);await page.goto('/trips')
  await page.locator('.page-header').getByRole('button',{name:'新建旅行',exact:true}).click()
  const create=page.getByRole('dialog',{name:'新建旅行',exact:true})
  await create.getByRole('button',{name:'保存',exact:true}).click()
  await expect(create.locator('.el-form-item__error')).toHaveCount(3)
  await create.getByRole('button',{name:'取消',exact:true}).click()
  await page.goto('/trips/1');await page.getByRole('button',{name:'编辑旅行',exact:true}).click()
  const edit=page.getByRole('dialog',{name:'编辑旅行',exact:true});await edit.getByRole('button',{name:'保存',exact:true}).click()
  await expect(edit.locator('.el-form-item__error')).toContainText(['请扩大日期范围'])
  await expect(edit).toBeVisible();await shot(page,'06-字段校验')
})

test('四态之成功态新增后跳详情，提交中禁止重复',async({page})=>{
  const state=await setup(page);await page.goto('/trips');await page.locator('.page-header').getByRole('button',{name:'新建旅行',exact:true}).click()
  const dialog=page.getByRole('dialog',{name:'新建旅行',exact:true})
  await dialog.getByPlaceholder('例如：重庆三日游').fill('新建验收旅行')
  await dialog.locator('.el-select').click();await page.getByRole('option',{name:'北京市',exact:true}).click()
  await dialog.getByPlaceholder('开始日期').fill('2026-12-01');await dialog.getByPlaceholder('结束日期').fill('2026-12-03');await dialog.getByPlaceholder('结束日期').press('Tab')
  await dialog.getByRole('button',{name:'保存',exact:true}).click()
  await expect(dialog.getByRole('button',{name:'保存',exact:true})).toBeDisabled()
  await expect(page).toHaveURL(/\/trips\/99$/)
  expect(state.writes).toBe(1)
  await expect(page.locator('.el-message--success')).toContainText('旅行创建成功')
  await shot(page,'04-成功态')
})

test('收藏筛选无结果保持条件并提示没有匹配记录',async({page})=>{
  await setup(page);await page.goto('/favorites');await page.getByPlaceholder('搜索收藏景点').fill('无匹配景点');await page.getByRole('button',{name:'查询',exact:true}).click()
  await expect(page.locator('.el-empty')).toContainText('没有匹配的记录')
  await expect(page.getByPlaceholder('搜索收藏景点')).toHaveValue('无匹配景点')
  await expect(page.getByRole('button',{name:'清空条件',exact:true})).toBeVisible()
})
