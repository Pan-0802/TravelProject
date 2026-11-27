# Travel Planner 后端

Java 17 / 21、Spring Boot 3.5、MyBatis、MySQL 8.0.16+。首次部署请从 [根目录 README](../README.md) 开始。

Navicat 连接、空库创建、完整备份导入、数据库用户名与系统账号的区别，以及 `.env.local` 填写和常见报错，见 [数据库配置详解](../README.md#database-setup)。

私下收到高德和 AI Key 后，按 [API 配置详解](../README.md#api-setup) 填写四项服务信息；该章节包含启动脚本 / IDEA 两种配置方式、模型列表查询、白名单和实际调用的验证方法。

## 数据库与配置

- 新安装执行 [src/main/resources/db/mysql/schema.sql](src/main/resources/db/mysql/schema.sql)，包含完整 10 张空表，不插入用户或演示业务数据。
- 旧 8 表版本执行 [upgrade-chat.sql](src/main/resources/db/mysql/upgrade-chat.sql)，只增加两张聊天表，不清空业务数据。
- SQL 随 Maven 构建进入 JAR，不依赖仓库外的课程资料。
- 复制 `.env.example` 为 `.env.local`，填写本机 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、固定随机 `JWT_SECRET`。真实值不提交 Git。

从根目录首次初始化默认专用库（库必须尚不存在）：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-DemoDatabase.ps1
```

从根目录启动：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Start-Backend.ps1
```

直接从 IDEA 或 Maven 运行不会自动读取 `.env.local`，请自行设置环境变量。默认端口 8080，数据库就绪检查为 `/health/ready`。新库在前端自行注册，没有内置真实模式账号。

## 开发结构与接口

`controller` 接收 HTTP，`service` 执行业务校验与事务，`mapper` / Mapper XML 执行参数化 SQL。所有私有资源校验当前用户归属，分页在 SQL 执行，金额使用 BigDecimal。

| 功能 | 路径 |
| --- | --- |
| 注册、登录、退出 | `/api/auth/*` |
| 当前用户、资料、密码 | `/api/users/me` |
| 旅行和每日活动 | `/api/trips`、`/api/trips/{id}/days`、`/api/trips/{id}/days/{date}/items`、`/api/itinerary-items/{id}` |
| 景点、收藏、高德搜索 | `/api/attractions`、`/api/favorites`、`/api/pois/search` |
| 实际消费、预算 | `/api/trips/{id}/expenses`、`/api/trips/{id}/budget-summary` |
| 数据统计 | `/api/statistics/*` |
| AI 草稿与确认保存 | `/api/ai/plans` |
| 多轮规划对话 | `/api/ai/conversations` |

具体请求见 [requests.http](requests.http) 和 Controller / DTO 源码。先登录，再用自己的 Token 和接口实际返回的 ID；示例中的 ID 不代表新数据库里已经有记录。

聊天提交使用 `POST /api/ai/conversations/{id}/messages/submit`，快速返回 HTTP 202，再通过会话查询获取持久状态。后台生成失败保留原草稿；问答不修改方案，调整生成独立草稿，确认后才在事务中写正式行程，实际消费不被 AI 覆盖。

高德只用于地点搜索，AI 适配 Chat Completions / JSON 响应。配置 `AMAP_KEY`、`AI_API_KEY`、`AI_BASE_URL` 和账号实际可用的 `AI_MODEL`；未配置时对应服务返回明确错误。距离核验端点已移除。

JWT 默认 24 小时。修改密码后前端要求重新登录；当前 JWT 没有服务器端即时撤销机制。

## 测试与打包

从 `backend/` 执行：

```powershell
mvn test
mvn -DskipTests package
java -jar target/travel-backend-0.1.0-SNAPSHOT.jar
```

最后一条需当前进程已有数据库和 JWT 环境变量。基础测试使用独立 H2 和模拟 AI，不使用日常数据库或付费模型。

真实 MySQL 验收：

```powershell
.\scripts\Test-MysqlAcceptance.ps1 -ServerUrl 'jdbc:mysql://127.0.0.1:3306/' -Username root
```

输入本机密码；该测试只允许本机服务，以固定的 `travel_acceptance_course` 隔离，已有同名库时拒绝执行，只删除本次成功创建的测试库。

旧库聊天升级可选用 `scripts/Install-ChatSchema.ps1`，读取 `.env.local` 或已设置的数据库环境变量，需要 `JAVA_HOME` 和已经下载的 MySQL JDBC 驱动。新安装已包含聊天表，无需再运行升级。

`generate_models.py` 是初始八表模型生成器，不是运行步骤；不要对已有手写实体和 Mapper 重新运行它。
