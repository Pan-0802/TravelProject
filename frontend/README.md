# 个人旅行记录与智能规划系统 · 前端

《数据库原理与应用》课程设计前端工程，技术栈 **Vue 3 + Vite + TypeScript + Element Plus + Axios + ECharts**，
严格按《前后端 API 接口对接文档 V1.0》实现页面、请求封装与字段约定。

## 一、运行前准备

| 项目 | 要求 |
|---|---|
| Node.js | **20.19+、22.12+ 或 24**，本轮使用 24.11.1；可按 `.nvmrc` 统一使用 24 |
| 包管理器 | npm（随 Node 安装） |
| 浏览器 | Chrome / Edge 最新版 |
| 后端 | Spring Boot，默认 `http://localhost:8080`（仅真实联调时需要） |

> 没有 Node 时，先到 <https://nodejs.org/zh-cn> 下载 LTS 版安装包，安装后**重新打开终端**再执行下面的命令。

## 二、安装与启动

```bash
cd frontend
npm install          # 首次安装依赖
npm run dev          # 连接真实后端（/api 代理到 http://localhost:8080）
npm run dev:mock     # Mock 演示模式，不需要后端
```

启动后打开终端提示的地址（默认 <http://localhost:5173>）。双击 `启动网页.bat` 默认连接真实后端；明确需要 Mock 演示时运行 `npm run dev:mock` 或 `启动网页.bat mock`。真实与 Mock 切换后需退出旧登录，再使用目标环境的账号登录。

**Mock 演示账号**

```text
用户名：demo_zhang
密码：  Test@123456
```

Mock 模式下所有数据保存在浏览器 `localStorage`，刷新不丢；控制台执行 `__resetTravelMockDb()` 可一键恢复初始演示数据。

## 三、脚本说明

| 命令 | 说明 |
|---|---|
| `npm run dev` | 开发服务器，`/api` 与 `/health` 代理到 `localhost:8080` |
| `npm run dev:mock` | Mock 模式，接管全部 `/api` 请求 |
| `npm run build` | 先做类型检查，再生产构建，产物在 `dist/` |
| `npm run preview` | 在 4173 预览构建产物，使用相同的后端代理 |
| `npm run type-check` | 单独运行 `vue-tsc` 类型检查 |
| `npm run test:e2e` | 当前29项场景，默认独立前端5175、后端18080；完整运行包含真实AI与三轮聊天调用 |
| `npm run test:boundaries` | 3 项受控响应的前端边界测试，无真实AI调用，不需要后端 |

后端不在本机时，在 `.env.development.local` 中写 `VITE_PROXY_TARGET=http://后端电脑IP:8080`，或在 PowerShell 设置进程环境变量；代理配置会读取当前模式的 `.env` 文件：

```powershell
$env:VITE_PROXY_TARGET = 'http://192.168.1.20:8080'
npm run dev
```

更换地址后重启 Vite。默认 API 前缀 `/api`，不需要前端持有数据库密码或第三方 Key。端口5173被占用时会明确报错，请关闭旧前端进程后重启，不再自动切换端口。

## 四、目录结构

```text
frontend/
├─ public/favicon.svg
├─ src/
│  ├─ api/                 # 9 个接口模块，与契约 12.3 一一对应
│  │  ├─ auth.ts  trip.ts  poi.ts  attraction.ts  favorite.ts
│  │  └─ itinerary.ts  expense.ts  ai.ts  statistics.ts
│  ├─ components/
│  │  ├─ trip/             # TripFormDialog / TripBudgetPanel
│  │  ├─ itinerary/        # ItineraryPanel / ItineraryItemDialog
│  │  ├─ expense/          # ExpensePanel / ExpenseFormDialog
│  │  └─ attraction/       # AttractionFormDialog / AttractionDetailDialog
│  ├─ composables/useEcharts.ts
│  ├─ constants/           # 枚举、标签、颜色、下拉选项
│  ├─ layouts/             # MainLayout（侧边栏布局）/ AuthLayout（登录注册）
│  ├─ mock/                # Mock 数据层（db.ts + index.ts）
│  ├─ router/              # 路由与登录守卫
│  ├─ stores/auth.ts       # Pinia 登录态
│  ├─ styles/main.css
│  ├─ types/api.ts         # 与契约对应的全部 DTO 类型
│  ├─ utils/               # request.ts（Axios 封装）/ auth.ts / format.ts
│  └─ views/               # 9 个业务页面 + 404
├─ .env.development        # 真实后端（默认）
├─ .env.mock               # Mock 模式
├─ index.html
├─ tsconfig.json
├─ vite.config.ts
└─ package.json
```

## 五、页面 ↔ 接口对照

| 页面 | 路由 | 使用接口 |
|---|---|---|
| 登录 / 注册 | `/auth/login`、`/auth/register` | A01、A02 |
| 旅行列表 | `/trips` | T01、T02、T04、T05 |
| 旅行详情（每日行程） | `/trips/:tripId` | T03、I01–I05 |
| 旅行详情（消费） | 同上·消费页签 | E01–E04 |
| 旅行详情（预算） | 同上·预算页签 | E05 |
| 景点探索 | `/attractions` | P01–P06、F02、F03 |
| 我的收藏 | `/favorites` | F01、F03 |
| AI 规划 | `/ai` | AI01、AI02 |
| AI 方案编辑/保存 | `/ai/result/:aiPlanId` | AI03、AI04 |
| 数据统计 | `/statistics` | S01–S04 |
| 个人中心 | `/profile` | A04–A06 |

## 六、与后端的对接约定（实现层面）

1. **统一响应**：`{ code, message, data }`；`code === 0` 才算成功，拦截器直接解包 `data`。
2. **鉴权**：登录后 Token 存 `sessionStorage.accessToken`，请求头 `Authorization: Bearer <token>`；收到 401 自动清登录态并跳转登录页。
3. **ID**：全部按**字符串**处理（如 `"101"`），不做数值运算。
4. **日期/时间**：日期 `yyyy-MM-dd`，时间 `HH:mm`；时间戳 `yyyy-MM-dd'T'HH:mm:ss`。
5. **分页**：`page` 从 1 开始，`size` 默认 10（列表页 10，卡片页 12，最大 50）。
6. **错误处理**：
   - 400/422 → 直接展示后端 `message`（字段级/业务原因）；
   - 404 → 旅行详情页显示"旅行不存在"空态；
   - 409 → AI 保存先重新确认草稿状态，仍为DRAFT才弹覆盖确认；已经SAVED则显示查看旅行，保留用户尚未提交的编辑直到明确状态；重复收藏时刷新列表；
   - 502/503/504 → AI 页面给出"外部服务异常/未配置/超时"的明确提示；
   - 前端从不展示 SQL、堆栈或第三方原始异常。
7. **高德查询与本地景点**：搜索时不自动落库；按2026-11-23更新后的交互要求，点击“录入景点”预填名称、城市和去重分类，核对或修改后才创建本地景点。保存后取得本地 `attractionId`，可收藏或在行程中关联；不保存原始POI响应、第三方ID、坐标或照片。门票未知时保存null。
8. **AI 草稿与正式行程分离**：预览/编辑阶段不写 `trip_day`、`itinerary_item`；点击"确认保存"才把**编辑后的** `days` 提交 AI04，遇到 409 弹窗确认后带 `confirmOverwrite: true` 重试。

## 七、前端验收要点（对应契约 TC01–TC20）

- [ ] 注册重复用户名 → 提示冲突（40900）
- [x] 密码错误 → 显示账号或密码错误；受保护请求的Token失效 → 清理登录态并回登录页
- [ ] 结束日期早于开始日期 → 表单层拦截 + 后端 422 提示
- [x] 删除旅行 → 二次确认文案说明级联删除行程与消费
- [ ] 重复收藏同一景点 → 409 提示且列表状态与后端一致
- [ ] 旅行日期外的消费日期 → 日期选择器禁用，提交前再校验
- [x] 行程项上移/下移 → 提交该天全部 ID，刷新后顺序保持
- [x] AI 方案未保存时 → 旅行行程不变（后端验收），页面取消覆盖时保留编辑
- [x] AI 保存遇到已有行程 → 弹窗确认覆盖，成功后跳转旅行详情
- [x] 统计、预算页面通过真实接口显示金额和图表；空统计由后端回归覆盖

## 八、常见问题

| 现象 | 原因与处理 |
|---|---|
| 页面提示"无法连接后端服务" | 后端未启动或端口不是 8080；先 `npm run dev:mock` 验证前端本身 |
| 所有接口 404 | 后端 `server.servlet.context-path` 不是 `/`，或未加 `/api` 前缀，与契约不符 |
| 401 循环跳登录 | 后端 JWT 校验失败；确认 `Authorization` 头与 Token 有效期（24h） |
| 浏览器控制台 CORS 报错 | 应走 Vite 代理（`/api`），不要在前端直连 `localhost:8080` 绝对地址 |
| 高德搜索报 50300 | 后端未配置 `AMAP_KEY`，其他功能不受影响 |
| AI 生成超时 | 后端读取超时默认60秒，前端等待90秒；先刷新规划历史确认请求结果，再决定是否重试 |
| 端口被占用 | 开发5173、预览4173固定端口；关闭旧服务后重启，或明确配置新端口及后端CORS |

## 九、2026-11-23 联调完善结果

追加景点预填录入：点击搜索结果的“录入景点”后带入名称、城市、去重分类，核对后保存；取消、切换结果及手工新增都正确重置表单。长名称与分类改为上下排列，避免文字挤成竖排。新增 `poi-prefill.spec.ts` 的2个浏览器场景通过（受控POI响应、真实后端保存及行程关联），类型检查与生产构建通过。可通过 `Test-Integration.ps1 -TestFile poi-prefill.spec.ts -JavaHome 'JDK根目录'` 单独复测，不调用AI。

已修复启动脚本误进Mock、30处类型错误、AI目标旅行绑定和目的地校验、重复保存409误弹覆盖框、选项只读取前50条、费用上限不一致、图表隐藏或重建后未初始化、登录密码错误误提示过期等问题。Vite、Vue类型工具和ECharts升级至修复版本，`npm audit` 本轮结果为0；构建已强制包含类型检查。

本轮使用真实后端、MySQL、Edge、高德和DeepSeek验证4个主要场景，另外完成2个真实增删改/个人资料场景，以及3个受控HTTP响应的边界场景。边界场景明确验证超过50条选项、其他窗口已经保存后的409、目的地不匹配时前端阻止提交；不以模拟场景代替真实主流程。

复测普通页面和AI需要启动后端。可在PowerShell使用一键验收脚本，读取本机IDEA中 `TravelApplication` 的配置，在18080启动独立后端，结束后停止该测试进程；不停止原8080服务：

```powershell
# 从frontend目录运行。JavaHome填写本机JDK17/21根目录；也可提前设置JAVA_HOME。
.\scripts\Test-Integration.ps1 -JavaHome '你的JDK根目录'

# 已有最新后端时直接复用，例如8080：
.\scripts\Test-Integration.ps1 -UseExistingBackend -BackendUrl 'http://127.0.0.1:8080'

# 仅测试前端边界，不调用模型、不需要数据库或后端：
npm run test:boundaries
```

浏览器验收使用已安装的Microsoft Edge，独立前端端口5175。完整测试会创建 `ui_accept_`、`ui_profile_`、`ui_crud_` 开头的测试账号，真实AI生成一次，数据与原演示账号隔离；不清空原有数据库。报告在 `playwright-report/` 和 `test-results/`，均被Git忽略。公开部署仍需配置生产Web服务器的 `/api` 反向代理和SPA路由回退；Vite开发代理及preview仅供本机联调。

## 十、当前 AI 聊天与行程界面（2026-11-25）

- 左侧连续聊天，右侧为`PlanTimeline`单日时间线。日期标签支持点击、方向键和Home/End切换；只展示当前一天。
- 时间线默认显示活动名称、时间、预计费用、到达方式和简短备注。点击“编辑”后打开弹窗，取消不改草稿，“应用修改”才更新预览。
- 支持添加、上下调整、移除、撤销上次修改、编辑当天说明。日期切换不会丢失已应用修改；发送时带入全部天数的编辑快照。
- 手工活动填写开始时间后自动插入当天对应位置，修改开始时间会重新归位。正式行程、景点探索加入行程和AI草稿都使用这条规则；未填开始时间先放末尾。已有错序或主动调整过顺序时可以点“按时间整理”恢复时间顺序。时间重叠仅提示，不自动改动原有安排或补造结束时间。
- “让 AI 调整这一天”填入明确日期并选择调整模式，仍需用户主动发送，不自动产生模型请求。
- “确认保存到旅行”写入正式行程；未选择旅行时打开选择弹窗，可就地创建匹配旅行。已有行程覆盖确认和实际消费隔离继续保留。
- 发送时每2.5秒查询状态，等待期间可以主动查询；失败后保留输入和草稿，同内容重试合并显示。

## 十一、已移除距离预估

聊天、旧方案页与正式行程页均移除距离核验入口、候选地点列表和路程失败卡片。`RouteOverview.vue`、前端路径API及后端两条路径端点已删除。高德POI实时搜索与景点录入保留；页面不会再请求`/api/pois/route`或`/api/pois/routes`。

## 十二、协作与验证

首次启用多轮会话的电脑仍需要执行`ER图和Mysql/04_AI多轮会话_增量升级.sql`；已执行过04的电脑本轮无需再运行SQL。更新后重启后端TravelApplication，前端在原运行终端Ctrl+C后执行`npm run dev`。

受控浏览器检查：`npm run test:e2e -- conversation.spec.ts planning-ux.spec.ts`，覆盖按天浏览、编辑取消、错误时间、顺序和撤销、添加及费用、下一轮完整快照、失败恢复，以及已删除模块不再发请求。

`chat-live.spec.ts`和`four-day-live.spec.ts`使用新账号和合成行程，验证真实模型生成、只问问题、参考编辑调整、保存覆盖、实际消费隔离与历史恢复。运行会使用已配置的服务并创建测试数据：

```powershell
.\scripts\Test-Integration.ps1 -TestFile @('chat-live.spec.ts','four-day-live.spec.ts') -JavaHome 'JDK根目录'
```

旧的acceptance路线图片及验收文件是历史记录，不代表当前版本仍有距离模块。

当前版验证：生产构建通过；完整36项浏览器回归通过，新增会话隔离及重庆长行程场景后，对全部26项聊天/规划UI再次回归通过，共覆盖39个不同场景。真实四天方案从18项调整为22项并保存，原31元测试消费保留。详见[本次验收记录](acceptance/ux-simplification-2026-11-25.json)、[重庆新版界面](acceptance/ai-chongqing-redesign.png)与[窄屏编辑弹窗](acceptance/ai-activity-editor-mobile.png)。

手工时间归位检查：`scripts/Test-Integration.ps1 -TestFile @('schedule.spec.ts','conversation.spec.ts') -JavaHome 'JDK根目录'`。`schedule.spec.ts`在独立账号的真实数据库中验证16点插入、改时间后归位、刷新后持久化、所选日期/关联景点/建议时长、旧记录整理与消费保留，不调用AI。


课程最终启动和完整10表初始化请以根目录README及schema.sql为准。新增本地配置启动入口：backend/scripts/Start-Backend.ps1。
