# 后端使用说明

已建立 Controller → Service → Mapper XML → MySQL 分层框架，覆盖 V1.0 的 39 个接口入口，并新增 `/health/ready` 和 `/api/pois/route`，再新增6个会话入口，共47个入口。包含认证、旅行、景点与收藏、行程、消费、统计，以及高德实时查询、路径核验和 AI 生成/确认保存代码。

## 环境与启动

需要 JDK 17 或 21、Maven 3.6.3+、MySQL 8.0.16+。在 IDEA 中打开本目录的 `pom.xml` 导入 Maven 工程，Project SDK 选 JDK 17 或 21。

1. 先在自己的空 MySQL 库运行根目录 `ER图和Mysql/01_建库建表_MySQL8.sql`。
2. 可选执行 `02_初始化测试数据.sql`，仅供新空库首次初始化。演示账号 `demo_zhang`，密码 `Test@123456`。
3. 配置数据库密码和 JWT 密钥，运行 `TravelApplication`。

PowerShell 示例（在 `backend/` 内执行）：

```powershell
# JAVA_HOME 指向本机 JDK 根目录；若已经正确配置可省略。
$env:JAVA_HOME = '你的JDK绝对路径'
$env:DB_USERNAME = 'root'
$env:DB_PASSWORD = '你的MySQL密码'
# 用随机32字节生成密钥；重启时保持同一值才能继续使用已有令牌。
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$env:JWT_SECRET = [Convert]::ToBase64String($bytes)
mvn spring-boot:run
```

访问 `http://localhost:8080/health` 检查进程存活，再访问 `http://localhost:8080/health/ready` 检查数据库连接及用户表是否可查询。就绪检查无需 Token；成功返回 `database: UP`，失败返回 HTTP 503 / `code: 50300`，不暴露连接地址、密码或 SQL 异常。后端默认 8080，允许前端源 `http://localhost:5173`，可通过 `CORS_ORIGINS` 修改。前端 Axios baseURL 为 `/api`，Vite 代理到后端即可。

本机 Navicat 的 `MySQL8-实验` 连接已确认使用 `127.0.0.1:3307`，IDEA 环境变量 `DB_URL` 应为：

```text
jdbc:mysql://127.0.0.1:3307/travel_planner_course?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
```

默认配置仍保留通用端口 3306；由环境变量覆盖本机地址。连接池获取连接最长等待 3 秒，连接校验超时 1 秒。

`.env.example` 是配置清单；Spring Boot 不会自动读取 `.env`。在 IDE 的 Environment variables 或 PowerShell 中设置变量。`JWT_SECRET` 至少 32 字节，缺失时启动直接失败；密码、JWT 密钥和第三方 Key 不写入仓库。

## 分层结构

```text
src/main/java/com/travel/
  common/       响应包装、错误映射、分页与字段合并校验
  security/     JWT、BCrypt、安全过滤器、当前用户
  domain/       对齐8张SQL表的持久化模型
  dto/          写请求DTO、枚举和AI结构
  controller/   39个HTTP接口
  service/      归属、日期、排序、预算、AI保存事务
  mapper/       显式CRUD接口及业务查询
  integration/  高德和可替换的AiClient模型适配器
src/main/resources/mapper/  8个表的参数化SQL映射
src/test/                  独立H2测试库与HTTP集成测试
requests.http              IDEA HTTP Client联调请求
```

实体与 XML 的初始生成器 `generate_models.py` 仅供溯源，不属于运行依赖。**不要在修改实体/Mapper 后重新执行它**，以免覆盖手写改动。数据库原始 SQL 是唯一的 MySQL 建表来源。

## 接口和业务约定

- 遵循原 V1.0 文档的路径与 `code=0` 成功格式，错误同时返回对应 HTTP 状态码。外部服务未配置返回 503，不返回模拟成功结果。
- Long 主键输出字符串；金额为 BigDecimal/JSON Number；时间为 `HH:mm`；日期和旅行状态按上海时区计算。
- JWT 有效期 24 小时；退出只通知客户端清除令牌。修改密码不会撤销现有 JWT，此行为与 V1.0 的无黑名单方案一致。
- 创建/修改 DTO 排除用户归属字段；所有私有资源从 Token 校验所有权，无权访问统一 404。景点允许登录用户浏览，仅本人修改。PATCH 只允许白名单字段，支持可选字段显式传 null。
- 每日行程包含空日期；写入、修改日期、排序和 AI 导入在事务内锁定旅行，排序连续化；删除旅行由既有数据库外键级联处理，AI 历史保留并解除关联。
- 新增活动有开始时间时，按开始时间整理当天全部活动，并写回连续的`sortOrder`；相同开始时间保持既有顺序，新活动排在同时间活动后面，未填开始时间的活动放在这些活动之后。修改实际开始时间（包括清空）同样归位；只改名称、备注、费用或结束时间时保留已有自定义顺序。显式排序接口仍可调整顺序。不会改动其他活动的起止时间、来源、费用或消费记录。
- AI 成功时只写草稿；确认后事务替换整趟旅行的活动，已有活动需 `confirmOverwrite=true`，保存过的草稿不可重复导入。预计费用不会新增实际消费。
- 旧 SQL 演示 AI 草稿缺少起止日期，能查询历史，但无法按新契约直接导入，需重新生成。

## 第三方服务

高德设置 `AMAP_KEY`，仅使用固定的 `/v5/place/text` 实时查询，不缓存或落库 POI。实现依据[高德 POI 2.0 文档](https://lbs.amap.com/api/webservice/guide/api/newpoisearch)。

AI 设置 `AI_API_KEY`、`AI_BASE_URL`（默认 `https://api.deepseek.com`）和 `AI_MODEL`（默认 `deepseek-flash`，请按账号实际可用模型修改）。默认模型与本次实际查询及联调结果一致。适配器采用 `/chat/completions`、`response_format=json_object`，实现依据 [Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。如供应商不支持此协议，替换 `AiClient` 实现。

外部连接超时 10 秒，读取超时 `EXTERNAL_TIMEOUT_SECONDS` 默认 60 秒。无 Key 为 503，外部失败/非法结构为 502，限流为 429，连接失败或超时为 504。接口不会透传外部 URL、Key 或原始异常。

## 验证与后续联调

```powershell
mvn test
mvn package
java -jar target/travel-backend-0.1.0-SNAPSHOT.jar
```

集成测试使用独立内存 H2 和模拟 AI，不需要本地 MySQL、API Key，也不调用收费服务。覆盖认证、ID序列化、用户隔离、PATCH白名单、日期/金额约束、排序、收藏唯一约束、级联删除、统计金额、AI草稿隔离、覆盖确认、重复保存以及中途写入异常的事务回滚。

验证范围已扩展为 26 项默认测试：19 项 HTTP 业务回归、5 项模拟 AI HTTP 测试、2 项数据库就绪故障测试。覆盖数据库分页和筛选计数、收藏显示标记、跨用户隔离、空统计、真实读取超时、限流及过期 Token。模拟存储异常日志来自回滚用例，是预期行为。

H2 测试中的 JSON 用 TEXT 替代。另有显式启用的 `MysqlAcceptanceTest`，使用原始 8 张表 DDL 创建随机命名的 `travel_acceptance_course` 数据库，在真实 MySQL 上运行相同的 19 项业务回归，并额外验证两次并发 AI 保存仅一次成功、另一次返回 409。测试结束删除本次创建的临时库，不读取或清空现有 `travel_planner_course` 数据，不调用真实 AI 或高德。

本轮已在本机 MySQL 3307 上通过全部 20 项验收，包含 JSON 存取、SQL 聚合、事务回滚及并发保存。默认 `mvn test` 跳过 MySQL 验收；需要再次执行时，可在已配置 JDK/Maven 的 PowerShell 中运行：

```powershell
# 从 backend/ 运行，读取本机 IDEA 已保存的 TravelApplication 环境变量；不会打印密码。
.\scripts\Test-MysqlAcceptance.ps1 -UseIdeaConfiguration

# 或显式指定本机服务地址，并交互输入密码：
.\scripts\Test-MysqlAcceptance.ps1 -ServerUrl 'jdbc:mysql://127.0.0.1:3307/' -Username root
```

该数据库账号需有创建/删除临时数据库的权限。异常终止进程可能留下以 `travel_acceptance_` 开头的临时库，确认其为测试遗留后再清理。

## 前端交接与手工验收顺序

1. 使用 `requests.http` 登录并设置 Token、创建或选择一趟旅行。
2. 查询空日期、添加/编辑/排序行程，新增/修改/删除真实消费，核对预算摘要和各统计图数据。
3. 查询高德实时结果；自建景点单独录入，验证收藏与取消收藏。
4. AI 生成后记录新的 `aiPlanId`。文件顶部的 `@aiPlanId = 5` 是此前演示值，换成当前记录 ID；先运行“读取 AI 草稿并准备保存”，再运行“确认保存 AI 行程”。
5. 已有活动时应返回 409；用户明确确认替换后设 `confirmOverwrite=true` 重试。成功返回 SAVED，查询正式行程确认来源为 AI，费用记录不增加。
6. 重复保存应返回 409；使用第二个账号访问第一个账号的旅行、行程、消费和 AI 记录，应返回 404。

前端 `../frontend/` 已接入真实接口，并在2026-11-23完成浏览器主流程与边界验收。前端保留401登录失效跳转、409覆盖确认与已保存状态区分、422业务提示、AI加载状态与历史查询、空列表和空日期显示。默认本地CORS包含localhost及127.0.0.1的5173开发、4173预览、5175自动验收端口；外部地址仍通过 `CORS_ORIGINS` 配置。

## 真实 AI 保存验收结果（2026-11-21）

已在实际运行的后端和 MySQL 上完成 21 项检查，调用真实 DeepSeek 模型生成方案 `6`，成功保存到独立验收旅行 `10`（`AI保存验收_20261121_195405`），共 3 天、9 个正式 AI 活动。验收验证了 DRAFT 预览不修改行程、409 覆盖确认、SAVED 状态与保存时间、活动内容逐项一致、重复保存拦截及数据库实际提交。

旅行 `10` 保留 12.34 元标明“AI保存验收用模拟消费”的测试记录，保存前后金额和记录均未变化；AI 预估 925 元未写为实际消费。该验收旅行和消费记录保留供复查，不代表真实出游开销。

原始方案 `5`、旅行 `9` 及其 2 个活动和 65 元消费均未被修改。证据见 [真实 AI 保存验收记录](acceptance/real-ai-save-2026-11-21.json)，其中不含 Token、API Key 或数据库密码。`requests.http` 末尾已补上 3 个只读查询请求，便于重新查看方案 `6`、旅行 `10` 的行程和预算。

旅行、景点、收藏、消费和 AI 历史列表现已采用 SQL 筛选、COUNT 和 LIMIT/OFFSET 分页；分类统计和总览由 SQL 聚合，避免费用连接造成预算重复求和。旅行列表/对比、景点收藏标记和每日活动查询已消除逐条额外查询。公开部署前仍需按实际规模补请求限流与运维监控。MyBatis 3.0 与 Spring Boot 3.5 的兼容范围见 [MyBatis 官方说明](https://mybatis.org/spring-boot-starter/mybatis-spring-boot-autoconfigure/)。

## 高德搜索与距离模块下线（2026-11-25）

保留`GET /api/pois/search`及既有`AMAP_KEY`，供景点探索使用。搜索通过串行队列和有限退避控制调用频率，`AMAP_INTERVAL_MILLIS`默认650毫秒。

距离模块已经删除：`RouteClient`、`PlaceResolver`和两个路径规划端点均移除，登录用户访问`/api/pois/route`或`/api/pois/routes`返回404。系统不再把模型给出的模糊地点用于距离或交通时长核验，不需要升级数据库。

`AI_MAX_OUTPUT_TOKENS` 默认16384；完整方案输出按天数分配，普通问答上限3072，不强制关闭模型的默认推理。模型响应单独规范化，不放宽HTTP请求的严格校验；忽略模型的无关附加字段，保留日期范围、时间、金额和禁止自动关联景点的业务校验。仅对字符串外的数字尾部多余引号、集合尾逗号作有限标点纠正，随后再次严格解析；不推断缺失值或补全截断对象。输出被截断、空内容和其余非法JSON分别提示，日志仅记录类别、结束原因、字符数或移除标点数量。

完整JSON对象后的非JSON附注被丢弃，不作为指令、记忆或行程字段使用；尾部出现另一个对象/数组或不完整结构时仍拒绝。此兼容仅针对模型返回内容，不改变用户请求的JSON校验。

AI提示词继续要求按邻近区域安排活动、预留转场时间。模型不声称已经调用地图，也不引导用户点击已下线的核验入口。不确定餐馆分店时，给出明确商圈附近的用餐建议，避免编造分店名和地址。可选`referenceDays`仍用于参考用户编辑后的安排，日期、时间和金额校验保持不变。

## 多轮会话升级（2026-11-25）

新增 AiConversationService、AiChatClient 和6个 /api/ai/conversations 接口，旧生成/保存接口兼容。数据库通过04增量脚本新增两张表，未升级时聊天接口返回503提示，不自动重跑原始SQL。可在本目录执行 .\scripts\Install-ChatSchema.ps1 -UseIdeaConfiguration -JavaHome 'JDK根目录'。

历史消息、编辑快照和用户偏好摘要由服务端组装上下文；问答不修改方案，调整创建独立DRAFT，确认后才写正式行程。短事务版本锁、发送标识、过期恢复和失败状态避免重复调用或跨窗口覆盖。详见 [接口与升级说明](../对接/AI多轮对话_接口与升级说明.md)。


课程最终启动和完整10表初始化请以根目录README及schema.sql为准。新增本地配置启动入口：backend/scripts/Start-Backend.ps1。
