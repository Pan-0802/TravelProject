# AI 多轮对话模块（2026-11-25）

## 使用流程

1. 从 AI 智能规划填写目的地、日期、预算和要求，点击“生成旅行方案”，进入聊天工作区。
2. 左侧连续聊天，右侧按日期标签浏览单日时间线；点击活动“编辑”才打开表单。可选择“自动判断”“只问问题”“调整方案”。
3. 问原因和建议时只返回解释；调整时参考当前编辑后的行程生成新草稿，旧版本仍保留。
4. 可以添加、调整顺序、移除及撤销活动。“让 AI 调整这一天”将日期带入输入框，用户发送后才调用模型。点击“保存草稿编辑”仅保存会话快照。
5. 点击“确认保存到旅行”才写正式行程；旅行已有活动时再次确认覆盖，已有消费保持独立。
6. 在 AI 首页“继续上次的聊天”恢复会话。旧方案页也可点击“在会话中继续讨论”。

## 数据库升级

原有8张业务表保持原结构，新加 `ai_conversation`（会话、条件、记忆摘要、当前方案与编辑快照）和 `ai_chat_message`（消息、发送状态、请求标识及版本关联），共10张表。

在现有 `travel_planner_course` 数据库执行 `ER图和Mysql/04_AI多轮会话_增量升级.sql`。脚本只创建两张新表，可以重复执行；不重新导入01/02，不删除已有数据。新电脑同样需要执行04。

也可在 backend 目录使用已经配置的环境变量：

```powershell
# JAVA_HOME 指向 JDK17/21；DB_URL/DB_USERNAME/DB_PASSWORD 已在当前终端配置。
.\scripts\Install-ChatSchema.ps1

# 本机 IDEA 配置有上述变量时，也可从该配置读取，不输出密钥。
.\scripts\Install-ChatSchema.ps1 -UseIdeaConfiguration -JavaHome '你的JDK根目录'
```

安装工具只允许执行两条 `CREATE TABLE IF NOT EXISTS`，使用现有 Maven MySQL 驱动。应用不会自动运行原始建库/演示数据脚本。数据库账号没有建表权限时，由数据库维护者执行04后再启动业务。聊天表未就绪返回503及升级提示，原有模块可继续使用。

## API

全部接口需要 `Authorization: Bearer <token>`，沿用 `{code,message,data}` 包装，ID 均为字符串。`version` 是服务端会话版本，客户端应直接使用最近响应的值。

| 方法 | 路径 | 用途 |
| --- | --- | --- |
| POST | `/api/ai/conversations` | 新建会话，或从自己已有的 AI 方案开始 |
| GET | `/api/ai/conversations?page=1&size=10` | 当前用户的会话分页列表 |
| GET | `/api/ai/conversations/{id}` | 消息、条件、当前方案、编辑快照与处理状态 |
| POST | `/api/ai/conversations/{id}/messages` | 发送一轮；外部请求等待期间不持有数据库事务 |
| PUT | `/api/ai/conversations/{id}/draft` | 保存编辑快照，不调用模型、不写正式行程 |
| DELETE | `/api/ai/conversations/{id}` | 删除会话与消息，保留生成过的方案和正式旅行 |

新建会话：

```json
{"conditions":{"tripId":"1","destination":"北京市","startDate":"2026-12-10","endDate":"2026-12-10","travelDays":1,"totalBudget":800,"transportation":"公共交通","preferences":["轻松"],"requirements":"带老人，少走路"}}
```

从旧方案继续：`{"aiPlanId":"1"}`。如同时提供 `currentDays`，验证后以该编辑快照开启新会话；未提供时优先恢复该方案关联的已有会话。`conditions` 和 `aiPlanId` 必须二选一。

发送消息：

```json
{"requestId":"client-generated-uuid","expectedVersion":0,"content":"为什么先安排这个景点？","intent":"ASK","currentDays":null}
```

`requestId` 为8–64位字母、数字、下划线或连字符。每次新发送使用新标识；网络结果不确定时使用同一个标识核对或重发，成功请求不会再次调用模型。失败后必须明确重试并使用新标识。`content` 1–2000字；`intent` 为 AUTO / ASK / REVISE。`currentDays` 可选，结构与原 AI days 相同，必须覆盖会话日期，供模型参考用户当前编辑。

响应是完整会话，包括 `conversationId/title/version/processing/conditions/memory/currentPlan/currentDays/messages`。消息包含 `messageId/requestId/role/content/status/errorMessage/planId/createdAt`；`role` 为 user/assistant，`status` 为 PENDING/COMPLETED/FAILED。助手消息的 `planId` 仅在该轮产生新方案时填写。

草稿编辑：`{"expectedVersion":2,"days":[...]}`。当前方案必须是 DRAFT，且没有待处理消息。正式保存复用原 `POST /api/ai/plans/{id}/save` 和覆盖确认机制。

## 上下文、并发与恢复

- 每次发送由服务端读取最近24条已完成消息，加上旅行条件、当前完整方案、用户偏好摘要和本轮问题，构成模型请求；不信任客户端自报的聊天历史或角色。
- 每个会话最多200条消息。完整记录保存于数据库，模型上下文仅使用最近消息与摘要，长期偏好由模型摘要接续；摘要可能有遗漏，当前明确条件与用户确认优先。
- 会话的目的地和日期固定，改变城市或日期需新建会话；聊天不会静默改动正式旅行的日期、预算或消费。
- 短事务锁定会话取得发送资格，外部调用在事务外进行；相同会话同时仅处理一条消息。响应、记忆和新草稿在事务内一起提交。
- 版本过期、重复发送处理中或其他窗口正在处理返回409。重复成功请求直接读取结果；模型失败保存FAILED，不自动重试付费调用。
- 发送开始即每2.5秒查询结果，等待期间可以主动“查询发送状态”，收到完成或失败结果便恢复输入，不必等待原HTTP连接返回。刷新页面同样只读取PENDING，不重新发送模型请求。进程异常造成的待处理记录在3分钟后通过读取会话恢复为FAILED，需用户手动重试。同内容失败消息在重试时合并显示，数据库完整记录仍保留。
- 未提交编辑与输入在当前窗口的 sessionStorage 备份；“保存草稿编辑”会持久化到数据库。新会话/新版本不会套用旧版本的本地快照。
- 用户无法读取、修改或删除其他人的会话；所有方案归属、日期、时间和金额继续使用原有校验。

模型调用采用 [DeepSeek 多轮上下文方式](https://api-docs.deepseek.com/guides/multi_round_chat/) 和 [JSON 输出](https://api-docs.deepseek.com/guides/json_mode/)，继续使用现有后端 AI_API_KEY/AI_BASE_URL/AI_MODEL。前端不持有 Key，无需更换服务商。

完整方案按旅行天数分配输出长度，最大受 `AI_MAX_OUTPUT_TOKENS`（默认16384）约束，保留服务商默认推理方式。模型响应兼容额外说明字段、完整JSON代码块、文本数组记忆以及H:mm/HH:mm:00等时间表示；仅纠正字符串外数字尾部多余引号和集合尾逗号，再严格解析并按既有业务规则检查。其余无效JSON、截断、非法日期/时间/金额仍拒绝，原方案保留；不推断缺失值、补猜行程或重复付费调用。

距离核验模块已经下线，两个`/api/pois/route(s)`接口已移除。页面不再显示距离、候选地点或核验失败列表；AI也不引导用户使用这些入口。高德实时景点搜索继续通过`/api/pois/search`提供。

模型在完整JSON对象后附带的非JSON说明会被丢弃；其中的标签或指令不参与回答、记忆和行程解析。尾部含第二个JSON对象/数组或残缺结构时仍拒绝，不在多个方案之间自行选择。

## 验证

后端 `mvn test` 覆盖历史恢复、ASK不改方案、上下文传递、请求幂等、并发、隔离、失败重试、草稿与日期校验。前端 `conversation.spec.ts` 使用受控服务验证UI；`chat-live.spec.ts` 使用专用账号与真实模型完成生成→解释→参考编辑调整→覆盖确认保存→刷新恢复，并检查原消费保留。

```powershell
# frontend目录，受控UI检查，无真实模型调用。
npm run test:e2e -- conversation.spec.ts

# 真实后端已启动且配置好模型；含三次真实模型调用及专用测试数据。
.\scripts\Test-Integration.ps1 -UseExistingBackend -BackendUrl 'http://127.0.0.1:8080' -TestFile chat-live.spec.ts
```

Mock 模式支持模拟聊天历史与方案演示，回复明确标为本地模拟；不会调用真实模型，也不提供真实地图路径。

## 2026年11月27日课程规范修订

页面发送改用 `POST /api/ai/conversations/{id}/messages/submit`，参数保持 `requestId`、`expectedVersion`、`content`、`intent` 和可选 `currentDays`。服务端先校验归属、版本与幂等，再持久化PENDING消息并快速返回 **HTTP 202**、`code:0` 和会话受理快照。202代表受理，不代表生成完成。

后台使用有界任务队列和当前用户的安全上下文；等待模型期间不占用数据库事务。页面每2.5秒GET会话详情，直到 `processing:false`。成功消息为COMPLETED；失败消息为FAILED并含可读错误。用户离开页面后可回来查询；相同已完成requestId重放不会再次调用模型。并发或版本冲突仍返回409。满队列返回503并明确未调用模型。

旧同步 `/messages` 及 `/api/ai/plans` 为兼容保留，课程页面生成已改用快速受理方式。普通请求默认3秒超时；超时先查询状态，不能自动重发付费生成。可定位的400/422错误以 `data.fieldErrors` 回传，页面显示在对应字段下方。

新电脑执行根目录 `schema.sql` 一次即可创建10张表和完整演示数据；旧开发库仅执行04增量脚本。真实模型验收需要显式设置 `RUN_LIVE_AI=true`，或给 `Test-Integration.ps1` 指定 `-RunLiveAi` / 真实模型测试文件，默认受控测试不调用付费模型。
