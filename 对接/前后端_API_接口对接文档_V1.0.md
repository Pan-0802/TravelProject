# 个人旅行记录与智能规划系统
## 前后端 API 接口对接文档 V1.0

**项目性质：**《数据库原理与应用》课程设计  
**项目人员：**后端 1 人、前端 1 人  
**版本日期：**2026-11-17  
**交付截止：**2026-11-30  
**技术栈：**Spring Boot + MyBatis + MySQL 8.0 + Vue 3 + Axios + Element Plus + ECharts + 高德 Web Service API + 大模型 API  
**数据库：**`travel_planner_course`  
**系统角色：**普通注册用户，无管理员及后台管理端

> **状态说明：** 本文是双方要遵守的**拟定接口契约**，不是已经上线的真实接口。签字/双方确认后冻结 V1.0；接口字段以本文和已生成的 `01_建库建表_MySQL8.sql` 为准。如果修改，须同步更新前端 TypeScript 类型、后端 DTO、Apifox 示例和本文档。

---

# 1. 对接原则与职责

## 1.1 开发职责

| 后端负责人 | 前端负责人 | 双方共同验收 |
|---|---|---|
| Controller、DTO、Service、Mapper、MySQL 事务、权限校验、JWT、对接高德与 AI | Vue 页面、路由、表单校验、Axios 请求、Token 携带、加载态、ECharts、错误提示 | 请求字段、返回字段、错误码、联调日志、功能与数据库记录一致性 |

**约定：** 后端维护真实数据库；前端禁止直连 MySQL；第三方 Key 只放后端环境变量。前端可先用 Mock JSON 开发，但最终演示必须从后端读取真实数据库结果。

## 1.2 环境与地址

| 项目 | 开发约定 |
|---|---|
| 前端 | `http://localhost:5173` |
| 后端 | `http://localhost:8080` |
| API 前缀 | `/api` |
| 前端 Axios `baseURL` | `/api`（Vite 代理到 `http://localhost:8080`） |
| 数据库 | MySQL 8.0.16+，`travel_planner_course` |
| Content-Type | `application/json; charset=UTF-8` |
| 日期 | `yyyy-MM-dd`，例如 `2026-12-01` |
| 时间 | `HH:mm`（请求/响应）；Java `LocalTime`，MySQL `TIME` |
| 日期区间 | 开始日期、结束日期均计入，`days = endDate - startDate + 1` |
| 时区 | 统一业务日期按 `Asia/Shanghai` 计算；若正式部署需改为用户时区，则另立需求 |
| 字段风格 | 数据库 `snake_case`；API JSON 和 Java DTO `camelCase` |
| 金额 | JSON Number，最多两位小数；Java `BigDecimal`；人民币元 |
| 主键 | API 中全部为十进制**字符串**，如 `"101"`；数据库 `BIGINT UNSIGNED` |
| 布尔值 | JSON Boolean（`true/false`） |
| 可选字段 | 无值时返回 `null`，集合统一返回 `[]` |
| 分页 | `page` 从 1 开始；`size` 通用默认 10，最大 50；高德搜索单页最大 25 |

两个开发者如果不在同一台电脑，前端不可把 `localhost:8080` 当作后端同事的电脑；应改用局域网 IP/测试服务器地址，并统一 `.env.development`。

## 1.3 通用响应结构

正常响应（包括空列表）使用统一包装：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

出错响应：

```json
{
  "code": 42200,
  "message": "结束日期不能早于开始日期",
  "data": null
}
```

分页响应：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "list": [],
    "total": 0,
    "page": 1,
    "size": 10
  }
}
```

HTTP 层状态码应与错误类型相匹配，不能所有错误都返回 HTTP 200。列表没有数据时用 HTTP 200 + 空数组；不存在的单条资源用 HTTP 404。

| HTTP | `code` | 典型情形 | 前端动作 |
|---|---:|---|---|
| 200/201 | 0 | 查询/操作成功 | 刷新数据或跳转 |
| 400 | 40001 | 参数缺失、字段格式错误 | 展示字段级错误 |
| 401 | 40100 | Token 缺失、无效或过期 | 清理登录态并跳转登录页 |
| 403 | 40300 | 无权操作当前资源 | 提示无权限 |
| 404 | 40400 | ID 对应资源不存在 | 提示数据不存在 |
| 409 | 40900 | 用户名重复、重复收藏、AI 重复保存、覆盖未确认 | 提示冲突并允许重新操作 |
| 422 | 42200 | 跨日期、数据归属、业务逻辑不满足 | 展示具体业务原因 |
| 429 | 42900 | 请求过于频繁 | 提示稍后重试 |
| 502 | 50200 | 高德/大模型请求失败或结构不可解析 | 提示外部服务异常 |
| 503 | 50300 | 未配置 API Key 或外部服务不可用 | 提示服务未配置/暂不可用 |
| 504 | 50400 | 调用外部服务超时 | 提示超时并允许重试 |
| 500 | 50000 | 未预期的服务器异常 | 展示通用错误，不展示 SQL/堆栈 |

## 1.4 鉴权与安全

- V1.0 只采用**普通用户 JWT Access Token**。注册、登录、`GET /health` 无需身份；其他接口必须携带 `Authorization: Bearer <accessToken>`。
- 登录令牌拟有效期 24 小时（`expiresIn: 86400` 秒），需后端与前端共同确认。前端建议放 `sessionStorage`（关闭标签页失效），不得输出到日志。
- **退出接口**为兼容前端流程保留；在没有令牌黑名单的 V1.0 中，退出仅客户端清除令牌，不代表未到期 JWT 在服务端立即失效。需要强制撤销时应增加服务端撤销机制并修订契约。
- 后端从 JWT 解析当前用户 ID，**不接受前端自行指定的 `userId`**；所有旅行、费用、行程、AI 记录必须校验归属权。
- 对外部服务的 URL、Key、Cookie、原始异常不透传前端；密码使用 BCrypt 哈希校验。

---

# 2. 接口总览（按模块）

> `✓` 表示必须登录。所有查询接口成功 HTTP 200；创建通常 HTTP 201；删除成功返回 HTTP 200 + `data: {"deleted":true}`，避免前端对 HTTP 204 的包装解析分歧。

| 序号 | 方法 | 路径 | 用途 | 鉴权 | 优先级 |
|---|---|---|---|---|---|
| A01 | POST | `/api/auth/register` | 注册 | 否 | P0 |
| A02 | POST | `/api/auth/login` | 登录 | 否 | P0 |
| A03 | POST | `/api/auth/logout` | 退出（客户端清 Token） | ✓ | P0 |
| A04 | GET | `/api/users/me` | 查询个人资料 | ✓ | P1 |
| A05 | PATCH | `/api/users/me` | 修改昵称 | ✓ | P1 |
| A06 | PATCH | `/api/users/me/password` | 修改密码 | ✓ | P1 |
| T01 | GET | `/api/trips` | 我的旅行分页列表 | ✓ | P0 |
| T02 | POST | `/api/trips` | 创建旅行 | ✓ | P0 |
| T03 | GET | `/api/trips/{tripId}` | 旅行详情 | ✓ | P0 |
| T04 | PATCH | `/api/trips/{tripId}` | 更新旅行 | ✓ | P0 |
| T05 | DELETE | `/api/trips/{tripId}` | 删除旅行及子记录 | ✓ | P0 |
| P01 | GET | `/api/pois/search` | 高德 POI 实时查询 | ✓ | P0 |
| P02 | GET | `/api/attractions` | 本地自建景点列表 | ✓ | P0 |
| P03 | POST | `/api/attractions` | 创建自建景点 | ✓ | P0 |
| P04 | GET | `/api/attractions/{attractionId}` | 自建景点详情 | ✓ | P0 |
| P05 | PATCH | `/api/attractions/{attractionId}` | 更新本人自建景点 | ✓ | P0 |
| P06 | DELETE | `/api/attractions/{attractionId}` | 删除本人自建景点 | ✓ | P0 |
| F01 | GET | `/api/favorites` | 我的收藏列表 | ✓ | P0 |
| F02 | POST | `/api/favorites` | 收藏本地自建景点 | ✓ | P0 |
| F03 | DELETE | `/api/favorites/{attractionId}` | 取消对景点的收藏 | ✓ | P0 |
| I01 | GET | `/api/trips/{tripId}/days` | 旅行按天行程 | ✓ | P0 |
| I02 | POST | `/api/trips/{tripId}/days/{date}/items` | 新增某天行程项 | ✓ | P0 |
| I03 | PATCH | `/api/itinerary-items/{itemId}` | 修改行程项 | ✓ | P0 |
| I04 | DELETE | `/api/itinerary-items/{itemId}` | 删除行程项 | ✓ | P0 |
| I05 | PUT | `/api/trips/{tripId}/days/{date}/items/order` | 重排行程项 | ✓ | P1 |
| E01 | GET | `/api/trips/{tripId}/expenses` | 旅行消费列表 | ✓ | P0 |
| E02 | POST | `/api/trips/{tripId}/expenses` | 新增消费 | ✓ | P0 |
| E03 | PATCH | `/api/expenses/{expenseId}` | 修改消费 | ✓ | P0 |
| E04 | DELETE | `/api/expenses/{expenseId}` | 删除消费 | ✓ | P0 |
| E05 | GET | `/api/trips/{tripId}/budget-summary` | 预算摘要 | ✓ | P0 |
| AI01 | POST | `/api/ai/plans` | 同步生成 AI 草稿 | ✓ | P0 |
| AI02 | GET | `/api/ai/plans` | 我的 AI 规划历史 | ✓ | P1 |
| AI03 | GET | `/api/ai/plans/{aiPlanId}` | AI 草稿详情 | ✓ | P0 |
| AI04 | POST | `/api/ai/plans/{aiPlanId}/save` | 事务保存编辑后的 AI 行程 | ✓ | P0 |
| S01 | GET | `/api/statistics/overview` | 旅行指标总览 | ✓ | P0 |
| S02 | GET | `/api/statistics/expense-categories` | 消费分类饼图 | ✓ | P0 |
| S03 | GET | `/api/statistics/trip-costs` | 旅行费用对比柱图 | ✓ | P0 |
| S04 | GET | `/api/statistics/budget-comparison` | 预算执行对比 | ✓ | P0 |
| H01 | GET | `/health` | 服务健康检查 | 否 | P0 |

**统计：** 39 个业务/健康检查接口（其中 P1 可延期）。P0 完整业务以“用户注册→建旅行→景点查询/自建收藏→行程/消费→AI 生成及正式保存→统计”为最小可演示闭环。

---

# 3. 通用 DTO / 枚举

## 3.1 UserDTO

```json
{
  "userId": "1",
  "username": "demo_zhang",
  "nickname": "小张",
  "createdAt": "2026-11-17T10:30:00"
}
```

不返回 `password_hash`；`nickname` 可为 `null`。`createdAt` 和其他时间戳为 `yyyy-MM-dd'T'HH:mm:ss`。

## 3.2 TripDTO

```json
{
  "tripId": "101",
  "title": "重庆三日游",
  "destination": "重庆",
  "startDate": "2026-12-01",
  "endDate": "2026-12-03",
  "totalBudget": 1500.00,
  "tripStatus": "NOT_STARTED",
  "daysCount": 3,
  "actualExpense": 0.00,
  "createdAt": "2026-11-17T11:00:00",
  "updatedAt": "2026-11-17T11:00:00"
}
```

`tripStatus` 是计算字段，不存数据库：`NOT_STARTED`（今天 < startDate）、`ONGOING`（期间）、`FINISHED`（今天 > endDate）。`daysCount` 为日期差 + 1，`actualExpense` 从 `expense` SUM 得到。

## 3.3 AttractionDTO（本地自建）

```json
{
  "attractionId": "201",
  "createdBy": "1",
  "name": "我喜欢的山顶观景点",
  "city": "重庆",
  "category": "观景",
  "description": "自己发现的观景位置",
  "suggestedDurationMinutes": 90,
  "referenceTicketPrice": 0.00,
  "isOwner": true,
  "isFavorited": false
}
```

`createdBy`/`isOwner`/`isFavorited` 只作为显示字段，**创建/修改请求不能指定 createdBy**。它与高德 POI 搜索临时结果类型不同，严禁前端把高德搜索条目 ID 当作 `attractionId`。

## 3.4 ItineraryItemDTO

```json
{
  "itemId": "401",
  "dayId": "301",
  "attractionId": null,
  "itemName": "解放碑步行游览",
  "startTime": "09:00",
  "endTime": "11:00",
  "sortOrder": 1,
  "transportation": "步行",
  "estimatedCost": 0.00,
  "sourceType": "MANUAL",
  "note": "用户自主安排"
}
```

数据库枚举：`sourceType = MANUAL | AI`；`attractionId` 只允许本地自建景点 ID 或 `null`。用户手工填活动名称时不需要景点外键。

## 3.5 ExpenseDTO / 类别

类别只使用以下固定值：`FOOD` 餐饮、`TRANSPORT` 交通、`HOTEL` 住宿、`TICKET` 门票、`SHOPPING` 购物、`OTHER` 其他。

```json
{
  "expenseId": "501",
  "tripId": "101",
  "category": "FOOD",
  "amount": 65.00,
  "spentOn": "2026-12-01",
  "description": "午餐",
  "createdAt": "2026-12-01T13:00:00"
}
```

## 3.6 AI 规划及状态

AI 记录状态与 SQL CHECK 一致：`DRAFT`（成功生成草稿）、`SAVED`（已经确认导入正式行程）、`FAILED`（生成失败）。不增加 `PROCESSING` 状态，因为 V1.0 是同步请求；若改异步要升级数据库及接口契约。

### AI 结构化 DayPlan（可编辑草稿）

```json
{
  "date": "2026-12-01",
  "dayNumber": 1,
  "description": "市区观光",
  "items": [
    {
      "itemName": "解放碑步行游览",
      "startTime": "09:00",
      "endTime": "11:00",
      "sortOrder": 1,
      "transportation": "步行",
      "estimatedCost": 0.00,
      "note": "注意旅行时间安排"
    }
  ]
}
```

AI 每条行程不直接带 `attractionId`（若用户后期自行关联了本地景点，可以在编辑器里显式选择本地 `attractionId`）。

---

# 4. M1 用户管理接口

## A01 POST `/api/auth/register` 用户注册

**鉴权：**无；**数据库：**`user` INSERT；**成功：**HTTP 201。

请求：

```json
{
  "username": "new_user",
  "password": "Test@123456",
  "confirmPassword": "Test@123456",
  "nickname": "旅行者"
}
```

校验：`username` 1–50 字且不为空，建议采用英文字母、数字、下划线；密码 8–72 字符；确认密码相同；`nickname` 0–60 字。`username` 唯一。密码使用 BCrypt 后写入 `password_hash`。

成功 `data`：

```json
{ "userId": "5", "username": "new_user", "nickname": "旅行者" }
```

失败：用户名重复 `40900`；确认密码不同、长度非法 `40001`。

## A02 POST `/api/auth/login` 用户登录

**鉴权：**无；**数据库：**`user` SELECT；**成功：**HTTP 200。

```json
{ "username": "new_user", "password": "Test@123456" }
```

成功 `data`：

```json
{
  "accessToken": "<真实JWT由后端生成>",
  "tokenType": "Bearer",
  "expiresIn": 86400,
  "user": {
    "userId": "5",
    "username": "new_user",
    "nickname": "旅行者",
    "createdAt": "2026-11-17T10:30:00"
  }
}
```

账号不存在或密码错误统一使用 `40100` 和通用提示“账号或密码错误”，避免暴露账号存在性。

## A03 POST `/api/auth/logout`

**鉴权：**✓；**数据库：**不修改；成功 `data: {"loggedOut":true}`。在纯 JWT V1.0 方案中服务端不撤销尚未过期令牌；前端收到成功后删除 Token 和本地缓存，跳转登录页。

## A04 GET `/api/users/me`

**鉴权：**✓；读取当前 Token 绑定用户的 UserDTO。禁止查询任意用户个人资料接口。

## A05 PATCH `/api/users/me`

**鉴权：**✓；**数据库：**`user` UPDATE。

请求：`{"nickname":"新的昵称"}`。本版只允许修改昵称；用户名不可修改。成功返回最新 UserDTO。

## A06 PATCH `/api/users/me/password`

**鉴权：**✓；**数据库：**`user` SELECT / UPDATE。

请求：`{"oldPassword":"旧密码","newPassword":"New@123456","confirmPassword":"New@123456"}`。校验旧密码和确认密码；成功 `data: {"updated":true}`，客户端清 Token 后重新登录。

---

# 5. M2 旅行计划接口

## T01 GET `/api/trips` 我的旅行列表

**鉴权：**✓；**数据库：**`trip` 以当前 `user_id` 过滤，聚合 `expense`；支持分页。

Query：`page=1&size=10&keyword=重庆&status=NOT_STARTED`（`keyword`、`status` 可不传）。后端状态按日期动态计算；默认按 `created_at DESC, trip_id DESC` 排序。

成功 `data`：

```json
{
  "list": [
    {
      "tripId": "101", "title": "重庆三日游", "destination": "重庆",
      "startDate": "2026-12-01", "endDate": "2026-12-03",
      "totalBudget": 1500.00, "tripStatus": "NOT_STARTED",
      "daysCount": 3, "actualExpense": 0.00,
      "createdAt": "2026-11-17T11:00:00", "updatedAt": "2026-11-17T11:00:00"
    }
  ],
  "total": 1, "page": 1, "size": 10
}
```

## T02 POST `/api/trips` 创建旅行

**鉴权：**✓；**数据库：**`trip` INSERT；**成功：**HTTP 201。

```json
{
  "title": "重庆三日游",
  "destination": "重庆",
  "startDate": "2026-12-01",
  "endDate": "2026-12-03",
  "totalBudget": 1500.00
}
```

校验：`title` 1–120 字、`destination` 1–120 字、日期合法且结束不早于开始；预算 `0≤totalBudget≤9999999999.99`，最多两位小数（受 DECIMAL(12,2) 限制）。`user_id` 必须来自 Token。**创建旅行时不必预先写满每天的 `trip_day`**，查询每日行程时可以生成虚拟日期条目，首次添加活动时才插入真实 `trip_day`。

成功 `data` 为 TripDTO。

## T03 GET `/api/trips/{tripId}` 旅行详情

**鉴权：**✓；按 `trip_id + 当前 user_id` 查询。成功返回 TripDTO；不存在返回 404；不是本人旅行统一返回 404（避免枚举他人资源）。

## T04 PATCH `/api/trips/{tripId}` 修改旅行

请求可只传需要更新的字段（至少一个）：

```json
{ "title": "重庆轻松三日游", "totalBudget": 1800.00 }
```

允许更新：`title`、`destination`、`startDate`、`endDate`、`totalBudget`。变更日期前，校验该旅行现有的 `trip_day.trip_date` 和 `expense.spent_on` 均在新范围内，否则返回 `42200`，要求用户先调整子数据；禁止自动静默删除已保存行程/消费。成功返回最新 TripDTO。

## T05 DELETE `/api/trips/{tripId}` 删除旅行

**鉴权：**✓；需要前端二次确认；**数据库：**一个事务中删除 `trip`，数据库 `ON DELETE CASCADE` 会删除关联 `trip_day` → `itinerary_item` 和 `expense`；`ai_plan_record.trip_id` 被置 `NULL` 保留历史。成功 `data: {"deleted":true,"tripId":"101"}`。不存在/非本人旅行返回 404。

---

# 6. M3 高德 POI 查询 + 本地自建景点

## 6.1 必须区分两类数据

> **2026-11-23 交互补充（按用户确认的新需求）：** 此节原“只能进入空白表单、全部独立填写”的交互限制更新为“可预填后确认录入”。前端点击实时结果的“录入景点”，仅预填名称、城市和格式化分类，允许用户修改；取消不写库，确认后通过原P03创建本地景点，再用其本地attractionId收藏或关联行程。API路径和数据库结构不变，不保存完整POI响应、第三方ID、坐标或照片。以下旧版空白录入约定以本补充为准。

1. **高德实时 POI**：仅用于当前页面查询和展示，不创建数据库行，不转成 `attractionId`，不批量存储/缓存/镜像。
2. **本地自建景点**：用户独立录入自己的名称、城市、说明、时长和参考门票价，写入 `attraction`，支持收藏和行程引用。

两类数据使用完全不同的字段类型和交互流程。前端搜索高德结果后不能调用“收藏该高德 POI”接口，因为这会把第三方返回内容直接落库；可以引导用户进入空白的“创建自建景点”表单，由用户独立填写。

**外部服务来源与边界：**高德 `GET https://restapi.amap.com/v5/place/text`；使用 Web 服务 Key，服务端请求；服务协议 3.5 对直接存储/缓存相关内容有限制，未获得额外授权不得擅自持久化。实际展示应遵守对应许可及标注要求。

## P01 GET `/api/pois/search` 查询高德 POI

**鉴权：**✓；**数据库：**无；**高德后端代理：**`/v5/place/text`。

Query 参数：

| 前端参数 | 类型 | 必填 | 默认值 | 映射高德参数 |
|---|---|---|---|---|
| `keywords` | string | 是 | — | `keywords`，最多 80 字符，只允许单关键词 |
| `region` | string | 是 | — | `region`，如“重庆市” |
| `cityLimit` | boolean | 否 | true | `city_limit` |
| `page` | integer | 否 | 1 | `page_num` |
| `size` | integer | 否 | 10 | `page_size`（1–25） |

示例：`GET /api/pois/search?keywords=博物馆&region=重庆市&cityLimit=true&page=1&size=10`

示例成功 `data`（**展示结构示例，非真实高德结果**）：

```json
{
  "source": "AMAP_LIVE",
  "page": 1,
  "size": 10,
  "list": [
    {
      "name": "演示景点名称",
      "address": "演示用地址",
      "city": "重庆市",
      "district": "渝中区",
      "type": "景点",
      "longitude": 106.5516,
      "latitude": 29.5630
    }
  ]
}
```

说明：`longitude` / `latitude` 可为 `null`；高德原始 `location` 经安全解析后转成数值。**不返回本系统的 `attractionId`**。高德返回的 `count` 是接口返回数量，不能误当全量 `total`；本接口不承诺全量分页总数。

后端校验高德 `status=="1"` 且 `infocode=="10000"`；超时返回 `50400`，无 Key `50300`，Key 无效/超限/外部错误统一根据情况映射 `50200`/`42900`，并输出安全、可理解的 `message`。高德配额按实际控制台为准，禁止高频自动抓取。URL 由服务端固定，不能让前端传入任意第三方 URL。

## P02 GET `/api/attractions` 本地景点列表

**鉴权：**✓；**数据库：**`attraction` + 当前用户 `favorite`。

Query：`page=1&size=10&keyword=观景&city=重庆&mineOnly=false`。`mineOnly=false` 可浏览已注册用户自建景点；`true` 仅本人创建。默认按 `created_at DESC`。

返回通用分页 `data`，`list` 元素为 AttractionDTO。

## P03 POST `/api/attractions` 新增本地景点

**鉴权：**✓；**数据库：**`attraction` INSERT；**成功：**HTTP 201。

```json
{
  "name": "我自己发现的观景点",
  "city": "重庆",
  "category": "观景",
  "description": "我自己整理的描述",
  "suggestedDurationMinutes": 90,
  "referenceTicketPrice": 0.00
}
```

校验依据 SQL：`name` 1–120、`city` 1–80、`category` 0–40、`description` TEXT、`suggestedDurationMinutes` 为 `null` 或正整数且符合 `SMALLINT UNSIGNED`（≤65535）、参考门票 `null` 或非负且最多两位小数。`createdBy` 从 Token 获取。成功返回 AttractionDTO。

## P04 GET `/api/attractions/{attractionId}` 本地景点详情

**鉴权：**✓；**数据库：**`attraction` SELECT；成功返回 AttractionDTO；不存在返回 404。自建景点可以由其他登录用户查看，但仅创建者有修改/删除权。

## P05 PATCH `/api/attractions/{attractionId}` 编辑景点

**鉴权：**✓；**权限：**仅 `created_by == 当前用户`；支持更新本地景点可编辑字段；成功返回最新 AttractionDTO；无权修改返回 403 或统一隐藏 404（双方应固定一种，V1 推荐 404）。

## P06 DELETE `/api/attractions/{attractionId}` 删除景点

**鉴权：**✓；仅创建者；前端二次确认。删除景点会自动级联删除收藏记录；`itinerary_item.attraction_id` 置空，但已有 `item_name` 保留，所以历史行程不会丢失活动名称。成功 `data:{"deleted":true}`。

## F01 GET `/api/favorites` 收藏列表

Query：`page=1&size=10&keyword=观景&city=重庆`。只返回当前用户收藏的**本地自建景点**；结果项可为 `{favoriteId, createdAt, attraction: AttractionDTO}`，`total/page/size` 与通用分页一致。

## F02 POST `/api/favorites` 收藏

```json
{ "attractionId": "201" }
```

前提：该 `attractionId` 在本地 `attraction` 表存在。成功 `data:{"favoriteId":"601","attractionId":"201"}`，HTTP 201；重复收藏由 `UNIQUE(user_id,attraction_id)` 阻止，返回 `40900`；不能接受高德 POI ID。

## F03 DELETE `/api/favorites/{attractionId}` 取消收藏

根据当前登录用户 + 本地 `attractionId` 删除 `favorite`；成功返回 `{"deleted":true}`；不存在可约定幂等返回 `{"deleted":false}`（V1 推荐此方式，便于前端重复点击）。

---

# 7. M4 行程安排接口

## I01 GET `/api/trips/{tripId}/days` 按日期查询所有行程

**鉴权：**✓；必须验证旅行属于当前用户。数据来自 `trip + trip_day + itinerary_item`；返回旅行起止日期范围内的**每一天**，即便没有真实 `trip_day` 行，也输出占位日 `dayId:null, items:[]`（占位日只存在于响应，不写数据库）。

成功 `data`：

```json
{
  "tripId": "101",
  "startDate": "2026-12-01",
  "endDate": "2026-12-03",
  "days": [
    {
      "dayId": "301",
      "date": "2026-12-01",
      "dayNumber": 1,
      "description": "市区游览",
      "items": [
        {
          "itemId": "401", "dayId": "301", "attractionId": null,
          "itemName": "解放碑步行游览", "startTime": "09:00", "endTime": "11:00",
          "sortOrder": 1, "transportation": "步行", "estimatedCost": 0.00,
          "sourceType": "MANUAL", "note": null
        }
      ]
    },
    { "dayId": null, "date": "2026-12-02", "dayNumber": 2, "description": null, "items": [] },
    { "dayId": null, "date": "2026-12-03", "dayNumber": 3, "description": null, "items": [] }
  ]
}
```

## I02 POST `/api/trips/{tripId}/days/{date}/items` 新增某日行程

**鉴权：**✓；`date` 格式 `yyyy-MM-dd`，必须落在旅行日期范围内。后端事务中“查找或创建” `(trip_id,trip_date)` 唯一的 `trip_day`，再插入 `itinerary_item`；并发重复创建时依赖唯一约束并进行正确的重试/读取。

```json
{
  "attractionId": null,
  "itemName": "午餐",
  "startTime": "12:00",
  "endTime": "13:00",
  "sortOrder": 2,
  "transportation": null,
  "estimatedCost": 65.00,
  "note": "用户自行安排"
}
```

约束：`itemName` 1–150；`attractionId` 可为 `null`，非空时必须存在于**本地** `attraction`；时间可空，若均存在则结束≥开始；`sortOrder≥1`；费用≥0；`sourceType` 由服务端固定为 `MANUAL`，不可通过用户请求伪造 AI 来源；`note`≤500。`sortOrder` 建议在 Service 层整理，禁止同一天最终出现重复排序值（数据库未对此建唯一键）。成功 `data` 为 ItineraryItemDTO。

时间归位规则（2026-11-25）：新增时`startTime`非空，服务端按开始时间整理当天全部活动，优先于请求的插入`sortOrder`；相同开始时间的新活动放在既有同时间活动后，未填开始时间的条目放在后面，写回连续序号。新增没有开始时间时沿用显式位置规则，页面默认追加到末尾。返回的`sortOrder`为最终位置，客户端应重读当天列表，不能继续使用添加前的末尾序号。

## I03 PATCH `/api/itinerary-items/{itemId}` 修改行程项

请求部分字段示例：

```json
{ "itemName":"午餐和休息", "startTime":"12:30", "endTime":"14:00", "estimatedCost":80.00 }
```

服务端由 `itemId -> dayId -> tripId -> userId` 验证归属；支持修改景点引用、名称、时间、交通、费用、备注；不允许移动到另一旅行/日期（要移动，可删除重建或后续扩展）；成功返回 ItineraryItemDTO。

开始时间实际发生变化时自动按上述时间规则归位；显式清空开始时间会移至未定时间条目末尾。开始时间不变时，名称、备注、费用和结束时间等编辑不重置自定义顺序。所有调整均在锁定本人旅行的事务中执行；其他活动的起止时间、来源和消费不受影响。页面展示的时间冲突是提醒，不作为拒绝保存的条件。

## I04 DELETE `/api/itinerary-items/{itemId}` 删除行程项

验证本人旅行后删除，成功 `{"deleted":true}`。是否保留空 `trip_day`：V1 保留空日记录（UI 仍显示当天）。

## I05 PUT `/api/trips/{tripId}/days/{date}/items/order` 排序

```json
{ "itemIds": ["401", "403", "402"] }
```

必须传入该天**全部**已有行程项 ID，不能缺失、重复、跨旅行；后端在一个事务中将 `sort_order` 依次更新为 1、2、3；成功返回该日期最新行程列表。初期前端可以先使用“上移/下移”按钮，暂不做拖拽。

页面的“按时间整理”复用此接口，提交完整的按开始时间稳定排序后的ID列表，修复历史版本遗留的末尾错序；不更改活动的时间、日期或内容。

---

# 8. M5 消费与预算接口

## E01 GET `/api/trips/{tripId}/expenses` 查询消费

Query：`page=1&size=10&category=FOOD&startDate=2026-12-01&endDate=2026-12-03`（除 page/size 外可选）；必须校验本人旅行。按 `spent_on DESC, expense_id DESC` 排序，结果为通用分页，元素为 ExpenseDTO。

## E02 POST `/api/trips/{tripId}/expenses` 新增实际消费

**数据库：**`expense` INSERT；成功 HTTP 201。

```json
{
  "category": "FOOD",
  "amount": 65.00,
  "spentOn": "2026-12-01",
  "description": "午餐"
}
```

校验：类别属于 6 种固定枚举；`amount>0` 且符合 `DECIMAL(12,2)`；`spentOn` 在旅行日期范围内（V1 暂不支持旅行前预订消费）；`description`≤300。成功 `data` 为 ExpenseDTO。**禁止**把 AI `estimatedCost` 或 `estimatedTotal` 写进 `expense`。

## E03 PATCH `/api/expenses/{expenseId}` 更新消费

请求可只传修改字段，校验规则同 E02。根据 `expenseId -> tripId -> userId` 验证归属；成功返回最新 ExpenseDTO。

## E04 DELETE `/api/expenses/{expenseId}` 删除消费

验证本人旅行，成功 `{"deleted":true}`；对应统计下次查询自动刷新。

## E05 GET `/api/trips/{tripId}/budget-summary` 预算执行

成功 `data`：

```json
{
  "tripId": "101",
  "totalBudget": 1500.00,
  "actualExpense": 950.00,
  "remainingBudget": 550.00,
  "overBudget": false,
  "categoryTotals": [
    { "category": "FOOD", "amount": 250.00 },
    { "category": "TRANSPORT", "amount": 100.00 },
    { "category": "HOTEL", "amount": 600.00 }
  ]
}
```

计算：`actualExpense = COALESCE(SUM(expense.amount),0)`；`remainingBudget = totalBudget - actualExpense`，允许为负；`overBudget = remainingBudget < 0`。无消费时返回 `0.00` 而非 `null`。

---

# 9. M6 AI 智能旅行规划接口（重点）

## 9.1 AI 与正式旅行数据的界限

- AI 生成请求存入 `ai_plan_record.request_json`；成功响应存入 `response_json`，状态 `DRAFT`；失败记录 `FAILED`，`response_json = null`，写入 `error_message`。
- **预览/编辑期间不修改** `trip_day` 或 `itinerary_item`。
- 用户点击“确认保存”后，将前端**最后一次编辑后的** `days` 发送给 AI04，后端使用事务写入真实行程；数据库 `source_type='AI'`。
- 预计费用保存在 `ai_plan_record.estimated_total` 和 `itinerary_item.estimated_cost`；**不自动新增** `expense`。
- 本版不复制高德 POI 原始数据到 AI 记录或行程结构；AI 输出只保留模型建议的行程文字，用户审核确认后作为自主规划内容保存。无需把高德完整 POI 响应当成 AI 提示词输入。

## AI01 POST `/api/ai/plans` 生成 AI 方案

**鉴权：**✓；**数据库：**`ai_plan_record` INSERT/UPDATE；**调用：**后端大模型 API。V1 同步 HTTP 请求，前端显示加载状态并避免重复提交。

请求：

```json
{
  "tripId": "101",
  "destination": "重庆",
  "startDate": "2026-12-01",
  "endDate": "2026-12-03",
  "travelDays": 3,
  "totalBudget": 1500.00,
  "transportation": "公共交通",
  "preferences": ["美食", "人文", "轻松"],
  "requirements": "行程不要太赶，安排一些休息时间"
}
```

`tripId` 可传 `null`，表示先规划再绑定旅行；若非空，必须属于当前用户，且日期、目的地与目标旅行一致（V1 不允许直接覆盖旅行设定）。`travelDays` 必须等于首末日期含端点的天数；生成参数校验上限建议 1–15 天以限制成本；`preferences` ≤10 项，`requirements` ≤500 字；预算≥0。

成功 `data`（仅演示 JSON 契约，非实时旅行信息）：

```json
{
  "aiPlanId": "701",
  "tripId": "101",
  "status": "DRAFT",
  "destination": "重庆",
  "startDate": "2026-12-01",
  "endDate": "2026-12-03",
  "travelDays": 3,
  "estimatedTotal": 1200.00,
  "days": [
    {
      "date": "2026-12-01", "dayNumber": 1, "description": "市区游览",
      "items": [
        { "itemName": "解放碑步行游览", "startTime": "09:00", "endTime": "11:00",
          "sortOrder": 1, "transportation": "步行", "estimatedCost": 0.00, "note": "建议提前确认开放情况" }
      ]
    },
    { "date": "2026-12-02", "dayNumber": 2, "description": "文化体验", "items": [] },
    { "date": "2026-12-03", "dayNumber": 3, "description": "自由活动", "items": [] }
  ],
  "createdAt": "2026-11-17T11:30:00"
}
```

校验模型结果：可解析 JSON、每天日期不重复、日期位于请求区间内、必须覆盖全部请求日期、每天 `dayNumber` 正确、必要 `itemName` 非空、时间合法、`sortOrder` 不重复、金额非负；非法结果不进入正式数据。前端需允许某一天无活动；AI 生成数据、门票/交通/天气建议未经实时核对时需标注“仅供参考”。

**错误处理：** API Key 缺失返回 `50300`；外部超时 `50400`；模型输出 JSON 解析失败 `50200`；失败时可保存 `FAILED` 记录，但不能展示为成功的草稿。建议后端外部调用超时为配置项（课程演示暂定 60 秒），前端 Axios AI 接口单独适配该超时；如实际超时频繁，再将该接口升级成任务提交+状态轮询，不能私自改变现有协议。

## AI02 GET `/api/ai/plans` 我的规划历史

Query：`page=1&size=10&status=DRAFT`（状态可选）。只返回本人记录，默认按 `created_at DESC`；分页列表项：`aiPlanId`、`tripId`、`status`、`destination`（从 `request_json` 提取）、`estimatedTotal`、`createdAt`、`savedAt`、`errorMessage`。列表不需要返回大型的 `response_json`。

## AI03 GET `/api/ai/plans/{aiPlanId}` 草稿详情

必须校验 `user_id`。成功返回 AI01 同结构，附 `request`（生成输入对象）、`savedAt`、`errorMessage`。`FAILED` 的 `days` 返回 `[]`。历史的 `response_json` 是当时模型生成的原草稿，不是前端编辑后的最终内容；正式行程以 `itinerary_item` 为准。

## AI04 POST `/api/ai/plans/{aiPlanId}/save` 确认保存行程

**鉴权：**✓；**数据库：**跨 `ai_plan_record`、`trip_day`、`itinerary_item` 事务；P0 关键接口。

请求：

```json
{
  "tripId": "101",
  "confirmOverwrite": false,
  "days": [
    {
      "date": "2026-12-01",
      "dayNumber": 1,
      "description": "市区游览",
      "items": [
        {
          "attractionId": null,
          "itemName": "解放碑步行游览（用户确认版）",
          "startTime": "09:00",
          "endTime": "10:30",
          "sortOrder": 1,
          "transportation": "步行",
          "estimatedCost": 0.00,
          "note": "用户手动修改后的时间"
        }
      ]
    },
    { "date": "2026-12-02", "dayNumber": 2, "description": null, "items": [] },
    { "date": "2026-12-03", "dayNumber": 3, "description": null, "items": [] }
  ]
}
```

**明确的覆盖策略：** 第一版只支持“替换目标旅行整个日期区间内已有的行程项目”这一种保存方式，以减少合并复杂度。若目标旅行已存在行程项且 `confirmOverwrite=false`，返回 HTTP 409 / `40900`，提示“已有行程，是否覆盖？”；前端弹窗确认后改为 `true` 再调用。覆盖仅针对行程，不删除费用、收藏、旅行计划。

服务端操作（全部在**同一事务**中）：

1. 获取 `ai_plan_record` 并核对 `userId`、状态 DRAFT；校验目标旅行存在且属于本人，日期区间与生成条件相符。
2. 锁定目标旅行的 `trip` 行（`SELECT ... FOR UPDATE`），防止同一旅行并发保存冲突；检测已存行程和 `confirmOverwrite`。
3. 验证编辑后的 `days` 包含全部日期且不重复；每个 `attractionId` 若有值，只能指向本地 `attraction`。
4. 已确认覆盖时删除该旅行现有 `itinerary_item`（按 `trip_day` 查），再更新或新增 `trip_day`，插入新的 `itinerary_item`（`source_type='AI'`）。可保留已有空日条目并同步说明。
5. 更新该 AI 记录的 `trip_id`、`status='SAVED'`、`saved_at=NOW()`；保留原始 `response_json` 供历史查看。
6. 任意一步失败，**ROLLBACK**；绝不能出现部分天数导入成功的情况。

成功 `data`：

```json
{
  "aiPlanId": "701",
  "tripId": "101",
  "status": "SAVED",
  "savedDays": 3,
  "savedItems": 1,
  "savedAt": "2026-11-17T12:00:00"
}
```

若 `aiPlanRecord` 已 `SAVED`，重复请求返回 `40900`，前端应跳转查看该旅行，而不是重复创建相同行程。若需要重导入，应先约定新业务流程，V1 不实现。目标旅行的全部现有行程会被替换，前端必须有明确提示。

---

# 10. M7 统计与可视化接口

**总规则：** 统计服务只查询 MySQL 的 `trip` / `expense` / `trip_day` 等真实表；不统计仅存在浏览器中的草稿；也不把 AI 预计费用当作实际消费。所有统计仅限当前登录用户。

## S01 GET `/api/statistics/overview`

成功 `data`：

```json
{
  "totalTrips": 8,
  "totalTravelDays": 25,
  "totalActualExpense": 6390.00,
  "totalBudget": 12000.00,
  "ongoingTrips": 1,
  "finishedTrips": 4,
  "upcomingTrips": 3
}
```

数字仅为响应结构举例。累计天数 = 各旅行 `(end_date - start_date + 1)` 求和；这统计的是**规划天数**，不是实际到访天数；旅行状态按上海时区当前日期动态计算。`LEFT JOIN expense` 时小心多表连接造成重复求和，建议分别聚合再合并。

## S02 GET `/api/statistics/expense-categories`

Query 可选 `tripId=101`；未传时统计当前用户全部旅行。若传非本人旅行，返回 404。

成功 `data`：

```json
{
  "totalAmount": 950.00,
  "items": [
    { "category": "FOOD", "name": "餐饮", "amount": 250.00, "percentage": 26.32 },
    { "category": "TRANSPORT", "name": "交通", "amount": 100.00, "percentage": 10.53 },
    { "category": "HOTEL", "name": "住宿", "amount": 600.00, "percentage": 63.15 }
  ]
}
```

`percentage` 由后端统一计算保留两位小数，因四舍五入不一定严格合计 100%。无消费时 `items=[]`、`totalAmount=0`，前端显示空态而非异常。

## S03 GET `/api/statistics/trip-costs`

Query：可选 `limit=10`（1–50），按最近创建旅行排序；返回当前用户的旅行费用明细供 ECharts 柱状图。

```json
{
  "items": [
    { "tripId": "101", "title": "重庆三日游", "actualExpense": 950.00 },
    { "tripId": "102", "title": "成都两日游", "actualExpense": 620.00 }
  ]
}
```

## S04 GET `/api/statistics/budget-comparison`

Query：可选 `limit=10`。返回每次旅行预算与实际消费：

```json
{
  "items": [
    { "tripId":"101", "title":"重庆三日游", "totalBudget":1500.00,
      "actualExpense":950.00, "remainingBudget":550.00, "overBudget":false }
  ]
}
```

---

# 11. 业务约束与 MySQL 映射

| 表 | 主键 / 关键外键 | 接口注意事项 |
|---|---|---|
| `user` | `user_id`、`username UNIQUE` | 用户名不能重复；密码为 BCrypt 哈希 |
| `trip` | `trip_id`、`user_id → user` | 日期前后合法；预算≥0；按 Token 过滤 |
| `attraction` | `attraction_id`、`created_by → user` | 只存用户独立录入内容；仅创建者可修改删除 |
| `favorite` | `favorite_id`、`user_id`、`attraction_id` | `(user_id,attraction_id)` 唯一；仅本地景点可收藏 |
| `trip_day` | `day_id`、`trip_id → trip` | `(trip_id,trip_date)` 唯一；业务层检查日期范围 |
| `itinerary_item` | `item_id`、`day_id → trip_day`、`attraction_id → attraction` 可空 | `MANUAL/AI`、时间、顺序与费用规则；不能关联高德 POI ID |
| `expense` | `expense_id`、`trip_id → trip` | 分类固定、金额>0、日期受限、只存真实记账 |
| `ai_plan_record` | `ai_plan_id`、`user_id`、可空 `trip_id` | `DRAFT/SAVED/FAILED`、JSON、AI 保存事务 |

**必须清楚：** 数据库外键只保证“关联记录存在”，不能自动保证“关联对象属于当前登录用户”“行程日期在旅行期间”“该草稿属于目标旅行”。这些属于 Service 业务校验，必须编写测试。

---

# 12. 前端接入规范与代码示例

## 12.1 Vite 代理示例

```ts
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
})
```

`GET /health` 不在 `/api` 下，若前端需调用，请增加代理或只用于后端手动检查。

## 12.2 Axios 实例示例

```ts
// frontend/src/utils/request.ts
import axios from 'axios'

export const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

request.interceptors.request.use(config => {
  const token = sessionStorage.getItem('accessToken')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

request.interceptors.response.use(
  response => {
    const body = response.data
    if (body.code !== 0) return Promise.reject(new Error(body.message || '请求失败'))
    return body.data
  },
  error => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem('accessToken')
      // 统一路由处理；不要在每个组件里重复写跳转
    }
    const message = error.response?.data?.message || error.message || '网络异常'
    return Promise.reject(new Error(message))
  }
)
```

**AI 生成**使用单独 Axios 实例或单个请求覆盖超时，例如 `timeout: 65000`；应与后端超时策略共同调整。对于 Axios TS 泛型，可以写服务层 wrapper `getData<T>()` 把 `Promise<AxiosResponse>` 正确收窄为 `Promise<T>`，避免将示意代码中的 `request.get()` 结果错误理解为原生 `T`。

## 12.3 API 模块化建议

```text
frontend/src/api/
  auth.ts           用户注册登录
  trip.ts           旅行计划
  poi.ts            高德实时查询
  attraction.ts     自建景点
  favorite.ts       收藏
  itinerary.ts      每日行程
  expense.ts        消费预算
  ai.ts             AI 生成/历史/保存
  statistics.ts     图表接口
```

**前端页面**：`Login`、`TripList`、`TripDetail`、`AttractionSearch`、`MyFavorites`、`Itinerary`、`Expense`、`AiPlanner`、`AiResult`、`Statistics`。建议先使用同一套 Mock JSON 接口响应，不要先画好页面再临时猜字段名。

---

# 13. 后端分层与代码组织建议

```text
backend/src/main/java/com/example/travel/
  controller/     AuthController, TripController, ...
  service/        AuthService, TripService, AiPlanService, ...
  mapper/         UserMapper, TripMapper, ...
  entity/         User, Trip, Attraction, ...
  dto/request/    RegisterRequest, CreateTripRequest, ...
  dto/response/   UserDTO, TripDTO, PageResult, ...
  config/         WebMvcConfig, JwtConfig, HttpClientConfig
  common/         ApiResponse, BusinessException, GlobalExceptionHandler
  security/       JwtAuthInterceptor, CurrentUser
  integration/    AmapPoiClient, AiChatClient
```

- `Controller`：只解析请求参数和返回结果。
- `Service`：身份/数据归属校验、事务、规则处理、第三方调用编排。
- `Mapper`：SQL / MyBatis XML、查询及更新。
- `integration`：外部 API 的请求、超时与响应转换，避免污染业务层。
- `@Transactional(rollbackFor = Exception.class)`：用于旅行级联删除（如额外逻辑）与 AI 正式行程保存。
- 密钥通过后端环境变量注入，如 `AMAP_WEB_KEY`、`AI_API_KEY`，不得提交到 Git。

---

# 14. 联调顺序、验收与边界用例

## 14.1 最小联调流程

| 序号 | 后端先完成 | 前端同步完成 | 验收 |
|---|---|---|---|
| 1 | A01/A02、JWT | 注册/登录、Token 存储 | 能注册并加载个人页 |
| 2 | T01–T05 | 旅行列表/表单/详情 | MySQL 实际增删改查成功 |
| 3 | P01–P06、F01–F03 | 高德搜索、自建景点、收藏 | 实时 POI 不落库，本地景点可收藏 |
| 4 | I01–I04 | 每日行程编辑页 | 修改后刷新仍存在 |
| 5 | E01–E05 | 消费页、预算卡片 | 分类统计和余额准确 |
| 6 | AI01/AI03/AI04 | AI 表单/草稿/编辑/保存 | 保存后在每日行程中出现 |
| 7 | S01–S04 | ECharts 统计页 | 数据来自真实查询 |
| 8 | P1 接口及异常 | UI 边界场景 | 演示和答辩稳定 |

## 14.2 双方必须测试的边界用例

| 编号 | 用例 | 预期结果 |
|---|---|---|
| TC01 | 用户名重复注册 | 409；user 无重复行 |
| TC02 | 密码错误 / 未携带 Token | 401 |
| TC03 | 用户 A 请求用户 B 的旅行 ID | 404（不泄露 B 数据） |
| TC04 | 结束日期早于开始日期 | 400/422；trip 不写入 |
| TC05 | 修改旅行日期导致已有行程落在区间外 | 422；trip 日期不变 |
| TC06 | 同用户重复收藏同一自建景点 | 409；favorite 仅一行 |
| TC07 | 收藏高德实时结果 ID | 400/404；不创建本地 POI 镜像 |
| TC08 | 旅行之外的日期添加活动 | 422；无新行程 |
| TC09 | 消费 0、负金额或非法分类 | 400/422；无记录 |
| TC10 | 无消费时查询预算 | actual=0；不会返回 null |
| TC11 | AI 结果非法 JSON / 第三方超时 | 502/504；无正式行程写入 |
| TC12 | AI 草稿预览但未保存 | trip_day/item 不变 |
| TC13 | 已有行程且 AI 保存未确认覆盖 | 409；原行程不变 |
| TC14 | AI 保存中第 2 天插入失败 | 全部回滚；原行程不变；草稿仍未 SAVED |
| TC15 | 同一 AI 规划重复保存 | 409；不重复插入 |
| TC16 | 删除旅行 | 子行程/消费级联删除；AI 历史与 trip 解除关联 |
| TC17 | 删除自建景点 | favorite 删除；行程 item_name 保留，attraction_id=null |
| TC18 | 高德 Key 缺失、无效、配额超限 | 给出安全错误提示，不影响已存业务数据 |
| TC19 | 统计数据 vs. SQL `SUM/GROUP BY` | 金额、分类、总数一致 |
| TC20 | 断开/重启后端再次查询旅行 | MySQL 持久化业务记录仍存在 |

## 14.3 双人接口交接规则

每完成一个接口，后端负责提交：① URL + HTTP 方法，② 请求 DTO，③ 成功/失败示例，④ Apifox 验证截图或运行结果，⑤ 依赖的 SQL/数据版本。前端确认页面联通后，标记为“联调通过”。

接口状态建议统一为：`待开发 → 后端完成 → 前端接入 → 联调通过 → 回归通过`。**禁止**未通知对方就改字段名、改状态码或改返回结构。

---

# 15. 项目目录与文档版本管理

```text
travel-planner/                   # GitHub 私有仓库
  backend/                        # Spring Boot + MyBatis
  frontend/                       # Vue 3 + Element Plus
  database/
    01_建库建表_MySQL8.sql
    02_初始化测试数据.sql
    03_验收查询与事务测试.sql
  docs/
    api-contract-v1.0.md         # 本文档
    requirements-v1.0.md
  .gitignore
  README.md
```

两个开发分支建议 `backend-dev`、`frontend-dev`。如数据库结构变更，不直接修改他人本机数据，另加数据库迁移脚本并更新字段字典。联调完成后，由前端将 Mock 数据全部替换为真实 API 调用。

## 15.1 当前版本明确不做

- 管理员登录/后台管理/角色权限表。
- 第三方高德 POI 数据批量采集、镜像入库、未授权缓存。
- 高德 POI 原始结果一键收藏、长期保存及路线导航。
- 小红书爬取、智能体编排、酒店预订、支付、上传旅行照片、日记管理。
- 异步 AI 任务平台、复杂 WebSocket 工作流、AI 聊天历史及多人共享旅行。

## 15.2 重要外部依赖与参考资料

1. 高德地图开放平台《搜索 POI 2.0》：https://developer.amap.com/api/webservice/guide/api-advanced/newpoisearch
2. 高德地图开放平台《服务协议》：https://developer.amap.com/pages/terms/
3. MySQL《FOREIGN KEY Constraints》：https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html
4. MySQL《CHECK Constraints》：https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html
5. GitHub 参考项目 TripStar-Java：https://github.com/LeeFly-cn/TripStar-Java

---

## 附录 A：双方对接确认清单

- [ ] 双方同步 `01_建库建表_MySQL8.sql`，数据库名和字段类型相同。
- [ ] 确认 `/api`、前后端端口、代理、`code=0` 成功规范。
- [ ] 确认 JWT 模式、有效期、用户归属验证机制。
- [ ] 确认日期、时间、金额、BIGINT ID 字符串化。
- [ ] 确认 P01 是只读高德实时查询，不向 attraction 自动写入 POI。
- [ ] 确认行程 AI `days` JSON、草稿/正式行程分离与覆盖确认。
- [ ] 确认 SQL 初始化与 Apifox 测试数据不会互相覆盖。
- [ ] 确认至少完成 TC01–TC20 的核心验收。

**版本结论：** 上述约定作为前后端开发 V1.0 的共同基线。若两人共同同意调整，可在 `docs/api-contract-v1.1.md` 中列出变更记录并同步更新代码。

## 2026-11-23 体验联动与路径核验扩展

现有写接口不变，前端补充旅行上下文、景点加入行程、方案内创建匹配旅行、活动发起消费和草稿恢复。AI 仍先生成草稿，确认保存后才写正式行程，预计费用不计入消费；新一版生成不会覆盖旧草稿。

P07距离核验已于2026-11-25下线：两个路径端点`POST /api/pois/route`、`POST /api/pois/routes`均删除，登录后访问返回404。前端不再展示估算距离、路径用时或候选点选择；M3高德POI搜索和用户确认后的景点录入不受影响。旧路线验收记录只对应历史版本。

AI01 生成请求增加可选 referenceDays（与 days 同结构、覆盖相同日期、最多15天），用于在当前用户编辑的方案基础上继续调整。省略时保持首次生成行为，失败不覆盖旧方案；模型仍不能自动关联本地 attractionId。

## 2026-11-25 多轮对话扩展

新增6个 /api/ai/conversations 接口，原AI01–AI04继续兼容。新增两张会话表，升级使用04增量SQL，不重建原库。请求版本、发送标识、历史上下文、ASK/REVISE/AUTO、草稿快照和恢复行为见 [AI多轮对话接口与升级说明](AI多轮对话_接口与升级说明.md)。


## 2026-11-25 单日时间线界面

多轮会话接口数据结构不变。前端按日期展示一日活动，弹窗编辑后通过原`currentDays`发送全部日期；保存草稿及正式保存继续沿用既有接口。支持添加、顺序调整、移除撤销、当日说明和明确日期的AI调整；预计费用保持独立，不生成实际消费。本轮无需新增SQL。
