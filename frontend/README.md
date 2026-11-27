# Travel Planner 前端

Vue 3、TypeScript、Element Plus、Axios、Pinia、ECharts 和 Vite。首次完整部署见 [根目录 README](../README.md)。

## 启动

需要 Node.js `^20.19.0` 或 `>=22.12.0`，可按 `.nvmrc` 使用 Node 24。在 `frontend/` 执行：

```powershell
npm ci
npm run dev
```

打开 `http://localhost:5173`。真实模式要求后端和 MySQL 已启动；新建空库没有登录账号，先在注册页创建自己的用户。

默认 `/api` 和 `/health` 代理到 `http://127.0.0.1:8080`。需要修改时，将 `.env.example` 复制为 `.env.development.local`：

```dotenv
VITE_API_BASE=/api
VITE_USE_MOCK=false
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

修改配置后重启前端。前端不保存数据库密码、JWT 签名密钥或第三方服务 Key；所有 `VITE_` 配置都应视为浏览器可见。

双击 `启动网页.bat` 默认启动真实接口模式。端口 5173 被占用时不会自动换端口，先确认是否已经启动过前端。

## 独立 Mock 演示

```powershell
npm run dev:mock
```

无需后端。仅此模式可用 `demo_zhang / Test@123456` 登录，演示数据保存在浏览器本地；与真实 MySQL 的账号和数据不互通。切换模式后退出旧登录，再使用目标环境的账号。

## 页面与交互

- 旅行、收藏、本地景点、消费列表统一每页 20 条，支持筛选、记录范围和详情操作。
- 从旅行进入景点或 AI 规划时保留上下文，关联创建带入目的地、日期和预算。
- 高德搜索结果点击录入后预填名称、城市和分类，确认保存后可收藏或加入行程。
- 手动活动填写开始时间后自动进入对应时间位置，修改开始时间会重新归位；时间重叠明确提示。
- AI 页面支持多轮聊天、历史恢复、按天查看方案、单个活动编辑和确认保存。后台受理后每 2.5 秒查询状态，受理不表示生成完成。
- 统计页和旅行预算页共用彩色消费类别：餐饮橙、交通蓝、住宿紫、门票绿、购物红、其他灰。
- 加载、空数据、错误和成功状态分别显示；字段校验定位到输入项，错误后保留条件和草稿。

## 验证与构建

```powershell
npm run type-check
npm run build
npm run preview
```

生产构建输出 `dist/`；preview 默认 4173，仅用于本机预览。正式部署需静态站点的 SPA 路由回退和 `/api` 反向代理。

已安装 Edge 后，可运行不调用付费模型的受控界面测试：

```powershell
npm run test:e2e -- boundaries.spec.ts conversation.spec.ts course-compliance.spec.ts
```

需要真实后端的联调示例：

```powershell
.\scripts\Test-Integration.ps1 -UseExistingBackend -BackendUrl 'http://127.0.0.1:8080' -TestFile poi-prefill.spec.ts
```

默认测试前端另用 5175。`chat-live.spec.ts`、`four-day-live.spec.ts` 和真实 AI 生成场景需要显式启用，可能产生费用。截图和报告写入已被 Git 忽略的测试输出目录。

旧 8 表后端首次使用多轮聊天时，按根目录 README 执行 `backend/src/main/resources/db/mysql/upgrade-chat.sql`；新安装的完整 10 表数据库不用再升级。
