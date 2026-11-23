# Travel Planner · 个人旅行记录与智能规划系统

《数据库原理与应用》课程设计，包含 Vue 前端、Spring Boot 后端、MySQL 脚本、接口文档和验收脚本。两位同学共用一个 GitHub 仓库，各自在本地开发，通过分支和 Pull Request 合并修改。

## 1. 功能与技术栈

- 用户注册、登录、个人资料和密码修改，JWT 身份认证。
- 旅行计划、每日行程、活动排序、消费记录、预算和统计图表。
- 本地景点与收藏、高德实时搜索；点击“录入景点”预填名称、城市和分类，核对并保存后可关联行程，搜索和取消不写库。
- AI 行程生成、草稿编辑和确认保存；覆盖已有行程需要确认，AI 预计花费与实际消费分开记录。
- 真实接口模式、独立 Mock 演示模式，以及后端和浏览器自动化测试。

当前范围为 **8 张表、普通用户系统**，不含管理员、照片和日记。实现以[最终需求说明书](个人旅行记录与智能规划系统_需求分析说明书_最终版.md)、[接口对接文档](对接/前后端_API_接口对接文档_V1.0.md)和[建表 SQL](ER图和Mysql/01_建库建表_MySQL8.sql)为准；较早的 `规划.md` 仅作背景参考。景点录入交互的后续调整已在接口文档中注明。

| 环境 | 要求 |
| --- | --- |
| 后端 | JDK 17 或 21、Maven 3.6.3+、Spring Boot 3.5、MyBatis |
| 数据库 | MySQL 8.0.16+，数据库名 `travel_planner_course` |
| 前端 | Vue 3、TypeScript、Element Plus、ECharts、Vite；Node.js `^20.19.0` 或 `>=22.12.0`，推荐按 `.nvmrc` 使用 Node 24 |
| 开发工具 | Git、IDEA / VS Code、Navicat 或其他 MySQL 客户端 |
| 浏览器 | 日常使用 Chrome / Edge；现有 Playwright 测试使用 Microsoft Edge |

首次安装后打开新终端，用 `java -version`、`mvn -version`、`node -v`、`npm -v`、`git --version` 检查工具。命令行启动需要正确配置 `JAVA_HOME` 和 Maven 的 PATH。

## 2. 项目目录

```text
TravelProject/
├─ backend/                 Spring Boot 后端
│  ├─ src/main/             Java、MyBatis XML、application.yml
│  ├─ src/test/             后端自动化测试
│  ├─ scripts/              MySQL 验收脚本
│  ├─ .env.example          后端环境变量清单，不含真实密码和 Key
│  ├─ requests.http         IDEA HTTP Client 联调请求
│  └─ README.md             后端详细说明
├─ frontend/                Vue 前端（实际开发目录）
│  ├─ src/                  页面、组件、接口封装、状态与 Mock
│  ├─ tests/                Playwright 浏览器测试
│  ├─ scripts/              联调验收脚本
│  ├─ .env.example          前端公开配置模板
│  ├─ package-lock.json     依赖锁定文件，需要提交
│  └─ README.md             前端详细说明
├─ ER图和Mysql/             ER 图、字段字典和 3 个 SQL 脚本
├─ 对接/                    API 契约与分工文档
├─ .gitignore               排除本机配置、密钥文件和构建产物
└─ README.md                安装、启动、GitHub 上传与双人协作
```

`fronte/` 当前为空，前端代码在 `frontend/`；Git 不会记录空目录。

## 3. 新电脑第一次运行

建议两人各自在自己的电脑上运行前后端和 MySQL。GitHub 同步代码和 SQL，**不会同步数据库中的账号、旅行数据，也不会同步本机环境变量**。

### 3.1 初始化自己的数据库

在 Navicat 连接自己的 MySQL 后，按顺序运行：

1. `ER图和Mysql/01_建库建表_MySQL8.sql`：首次创建数据库和表。
2. `ER图和Mysql/02_初始化测试数据.sql`：可选，仅在首次建立的空库中导入演示数据。
3. `ER图和Mysql/03_验收查询与事务测试.sql`：可选，检查数据和事务行为。

**已经导入过的数据库无需在每次启动或拉取代码后重新执行初始化脚本。** 增加自己的数据后，原演示数据数量不能作为当前数据量的固定判断标准。

导入演示数据后，可以直接登录：

```text
用户名：demo_zhang
密码：Test@123456
```

没有导入演示数据时，先通过注册页创建账号。这是应用登录账号，和 MySQL 的 `root` 账号不同。

### 3.2 配置并启动后端

在 IDEA 打开 `backend/pom.xml`，导入 Maven 项目，选择 JDK 17 或 21。在 `com.travel.TravelApplication` 的运行配置 **Environment variables** 中设置：

| 变量 | 必填 | 填写说明 |
| --- | --- | --- |
| `DB_URL` | 建议设置 | `jdbc:mysql://127.0.0.1:3307/travel_planner_course?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai`；端口按自己的 MySQL 修改 |
| `DB_USERNAME` | 是 | 自己的数据库用户名，例如 `root` |
| `DB_PASSWORD` | 是 | 自己的数据库密码 |
| `JWT_SECRET` | 是 | 至少 32 字节的随机密钥，生成方式见下方 |
| `AMAP_KEY` | 高德功能需要 | 高德 Web 服务 Key，仅配置在后端 |
| `AI_API_KEY` | AI 功能需要 | 模型服务的 API Key，仅配置在后端 |
| `AI_BASE_URL` | 可选 | 默认 `https://api.deepseek.com`，按实际服务商配置 |
| `AI_MODEL` | AI 功能需要 | 使用自己接口模型列表返回的模型 ID；本项目已验证 `deepseek-flash` |
| `SERVER_PORT` | 可选 | 默认 `8080` |
| `EXTERNAL_TIMEOUT_SECONDS` | 可选 | 默认 `60` 秒 |

数据库默认端口为 `3306`，当前原开发电脑的 MySQL 8 使用 `3307`，同学的端口不一定相同。IDEA 中设置的 `DB_URL` 会覆盖 `application.yml` 默认值。

在 PowerShell 执行一次以下命令生成 JWT 密钥，将输出填入 IDEA 的 `JWT_SECRET`，以后启动保持该值：

```powershell
$jwtBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($jwtBytes)
[Convert]::ToBase64String($jwtBytes)
```

`backend/.env.example` 是变量清单，**Spring Boot 不会自动加载 `.env` 文件**。真实值保存在本机运行配置里，不要填回已提交的 `application.yml` 或模板。

配置好后点击运行 `TravelApplication`。也可以在已设置环境变量的 PowerShell 窗口中，进入 `backend/` 执行：

```powershell
mvn spring-boot:run
```

后端启动后访问：

- `http://localhost:8080/health`：检查进程存活。
- `http://localhost:8080/health/ready`：检查数据库就绪；正常返回 `code: 0`、`database: UP`。

未配置高德或 AI Key 时可以使用基础功能，对应外部服务功能会明确提示未配置。详细说明见 [backend/README.md](backend/README.md)。

### 3.3 安装并启动前端

另开终端，在项目根目录执行：

```powershell
cd frontend
npm ci
npm run dev
```

打开 `http://localhost:5173`。`npm ci` 按锁定文件安装依赖，首次克隆或依赖发生变化后运行；普通代码修改不必每次重新安装。也可以双击 `frontend/启动网页.bat` 启动真实接口模式。

默认前端通过 `/api` 代理访问本机 `8080` 后端。需要自定义时，将 `frontend/.env.example` 复制为 `frontend/.env.development.local` 后修改，修改后重启前端：

```dotenv
VITE_API_BASE=/api
VITE_USE_MOCK=false
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

`.env.development.local` 已忽略，不提交。**所有 `VITE_` 变量都应视为浏览器可见配置，禁止存放 AI、高德 Web 服务 Key、JWT 密钥或数据库密码。**

仅演示页面时可运行 `npm run dev:mock`，无需后端。Mock 数据与真实 MySQL 数据分开，切换模式后退出旧登录再重新登录。详细说明见 [frontend/README.md](frontend/README.md)。

### 3.4 两台电脑联调（可选）

例如后端同学的局域网 IP 是 `192.168.1.20`，前端同学在自己的 `frontend/.env.development.local` 设置：

```dotenv
VITE_PROXY_TARGET=http://192.168.1.20:8080
```

两台电脑应处于可互通的网络，后端电脑允许前端电脑通过防火墙访问 8080，且后端保持启动。前端同学仍打开自己电脑的 `http://localhost:5173`，可先访问 `http://192.168.1.20:8080/health/ready` 验证后端连通性。

此方式使用后端同学的数据库和 API 配置；前端同学无需连接或开放 MySQL 端口。`localhost` 始终指当前访问它的那台电脑。

## 4. 首次上传 GitHub（仓库创建者操作一次）

以下使用 PowerShell / IDEA Terminal。将示例中的用户名、邮箱和仓库地址替换为自己的信息；不要在命令中填写 API Key。

### 4.1 创建远程空仓库

1. 登录 GitHub，进入 [新建仓库页面](https://github.com/new)。
2. Repository name 填 `TravelProject`，两人课程协作建议先选 **Private**。
3. **不要勾选初始化 README、`.gitignore` 或 License**，本地已有项目文件。
4. 点击 **Create repository**，复制 HTTPS 地址，类似 `https://github.com/YOUR_NAME/TravelProject.git`。

步骤依据 [GitHub：上传已有本地项目](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github)。

### 4.2 在整个项目的根目录初始化

当前原开发电脑的路径如下，其他电脑使用自己的路径：

```powershell
cd 'D:\Aaone\class\classProject\TravelProject'
git init -b main
git config user.name "YOUR_NAME"
git config user.email "YOUR_GITHUB_EMAIL"
git add .
git status --short
git diff --cached --stat
```

`user.name` 是提交显示名称，`user.email` 建议使用自己 GitHub 设置中的提交邮箱或 noreply 邮箱，它们不是登录密码。上述配置只作用于本仓库。**整个项目只在根目录初始化一次，不在前后端目录分别新建仓库。**

先核对暂存文件。应包含前后端源码、`package-lock.json`、SQL、README 和必要设计文档；不应包含：

- `.idea/`、`*.iml`、真实 `.env` / `.env.*.local`、`http-client.private.env.json`。
- `node_modules/`、`target/`、`dist/`、测试运行报告、日志。
- 真实数据库密码、JWT 密钥、API Key 或 `requests.http` 中临时粘贴的登录 Token。

可运行 `git diff --cached` 在本机检查提交内容，确认无误后继续：

```powershell
git commit -m "chore: initial TravelProject"
git remote add origin https://github.com/YOUR_NAME/TravelProject.git
git push -u origin main
```

首次 HTTPS 操作如弹出 Git Credential Manager 登录窗口，选择浏览器登录并授权自己的 GitHub 账号。Git for Windows 包含此工具，参见 [GitHub：缓存 Git 凭据](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git)。不要把 GitHub 网页密码当作命令行 Token，也不要把访问令牌放进仓库 URL。

刷新仓库首页，应看到根目录 README、`backend/` 和 `frontend/`。源码上传成功不代表网站已部署，数据库和第三方服务仍在运行后端的电脑上。

### 4.3 邀请另一位同学

仓库页面 → **Settings → Collaborators（部分界面为 Collaborators & teams）→ Add people** → 输入同学的 GitHub 用户名 → 发送邀请。

同学接受邀请后，才能访问私有仓库并提交分支。两人使用各自账号，无需共享 GitHub 密码。参见 [GitHub：邀请仓库协作者](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)。

### 4.4 同学克隆并安装

在希望存放项目的父目录执行：

```powershell
git clone https://github.com/YOUR_NAME/TravelProject.git
cd TravelProject
git config user.name "TEAMMATE_NAME"
git config user.email "TEAMMATE_GITHUB_EMAIL"
```

再按第 3 节初始化自己的数据库、后端配置并安装前端依赖。接受邀请后仍无法访问时，检查 Git 登录的是否为被邀请账号。

## 5. 两人日常修改与合并

GitHub 协作是“各自本地修改 → 提交分支 → 合并 → 对方拉取”，不会像在线文档一样实时同步。约定 `main` 保存可以运行的版本，每项任务从最新 `main` 创建新分支，提交 Pull Request 后由另一人检查。

| 负责人 | 主要目录 | 共同约定 |
| --- | --- | --- |
| 后端同学 | `backend/`、数据库脚本 | 接口路径、字段或状态码变化，同时更新接口文档并通知前端 |
| 前端同学 | `frontend/` | 根据契约调整请求、类型和页面；新增依赖同时提交 lock 文件 |
| 双方 | `README.md`、`对接/`、需求与 SQL | 改同一文件前沟通；数据库结构修改提供后续增量脚本和执行说明 |

### 5.1 开始新任务

先用 `git status` 确认当前工作已提交或妥善暂存，再执行：

```powershell
git switch main
git pull --ff-only origin main
git switch -c backend/improve-trip-validation
```

前端可用 `frontend/improve-attraction-form`。每次新任务使用新的分支名，上述名称仅为示例。

### 5.2 修改、验证并提交

在根目录检查并暂存需要提交的文件。后端任务示例：

```powershell
git status
git diff
git add backend
# 如果确实修改了共享文档，再添加对应文档。
git diff --cached --stat
git diff --cached
git commit -m "fix: validate trip dates"
git push -u origin backend/improve-trip-validation
```

前端同学相应使用 `git add frontend`，推送自己的分支名。暂存前恢复 `backend/requests.http` 中的临时 Token 占位符。提交前执行与改动有关的检查，见第 6 节。

### 5.3 在 GitHub 合并

1. 推送后打开 **Compare & pull request**，或 **Pull requests → New pull request**。
2. `base` 选 `main`，`compare` 选自己的分支；说明修改内容、验证方法和对方需要执行的 SQL / 配置步骤。
3. 另一人检查 **Files changed**，确认接口和页面可以衔接后再合并。通过后可用 **Squash and merge**。
4. 合并后，两人都在工作目录干净时执行 `git switch main`、`git pull --ff-only origin main`。下一项任务再新建分支。

这些是团队约定；私有仓库能否强制分支保护取决于账户方案，不影响先按此流程协作。

### 5.4 分支落后或发生冲突

提交自己的修改后，在自己的任务分支执行：

```powershell
git fetch origin
git merge origin/main
```

出现冲突时，打开冲突文件，和同学确认正确内容，删除 `<<<<<<<`、`=======`、`>>>>>>>` 标记，重新执行有关检查，再暂存实际冲突文件、`git commit`、`git push`。若依赖文件冲突，先确定 `package.json` 的正确依赖，再用 npm 更新对应 lock 文件。

暂时不能决定冲突内容时，可用 `git merge --abort` 退出这次合并，先沟通再处理。不要用强制推送或删除同学代码来解决冲突。

## 6. 提交前验证

只改文档时核对命令、路径和链接；改代码时按涉及范围执行：

| 检查 | 执行位置与命令 | 说明 |
| --- | --- | --- |
| 后端默认测试 | `backend/`：`mvn test` | 默认独立测试库，无需日常 MySQL 或真实 AI；MySQL 专项验收需显式启用 |
| 前端类型与构建 | `frontend/`：`npm run build` | 包含 TypeScript 检查，输出 `dist/`，产物不提交 |
| 前端边界测试 | `frontend/`：`npm run test:boundaries` | 受控响应，不调用真实 AI、不需要后端；需要 Edge 和前端依赖 |
| 浏览器联调 | 见下方 | 需要真实后端和数据库；完整套件含真实 AI 调用、产生测试数据并可能计费 |

同学首次克隆后没有原电脑的 IDEA 私有配置，建议自己先启动后端，再使用已有服务验收。从 `frontend/` 执行：

```powershell
# 完整验收：后端应已配置高德与 AI 服务。
.\scripts\Test-Integration.ps1 -UseExistingBackend -BackendUrl 'http://127.0.0.1:8080'

# 只验收景点预填、保存与行程关联：使用受控高德响应，不调用 AI。
.\scripts\Test-Integration.ps1 -UseExistingBackend -BackendUrl 'http://127.0.0.1:8080' -TestFile poi-prefill.spec.ts
```

脚本默认另开前端 5175。MySQL 事务专项验收、自动启动独立后端等进阶用法见[后端说明](backend/README.md)和[前端说明](frontend/README.md)。已有 `acceptance/` 报告记录的是当时验收结果，报告里的 ID 不代表新数据库中的 ID。

手工联调可使用 `backend/requests.http`：先登录，使用返回的 `accessToken` 调受保护接口，用自己数据库实际返回的旅行 / 景点 / AI 方案 ID 替换示例值。

## 7. 密钥与配置的提交约定

- 共享变量名和不含秘密的 `.env.example`，两人各自设置真实值。
- `.gitignore` 已排除 IDEA 私有配置、本机环境文件、构建产物和测试运行输出；不要使用 `git add -f` 绕过规则。
- 使用上面的 Git 流程上传。网页拖拽上传、截图或手工新建文件时，也要检查内容；`.gitignore` 不是内容脱敏工具。
- 前端只保留公开配置，第三方请求由后端携带 Key 发出。私有仓库也不存真实密钥。
- 若密钥已经提交或推送，先在服务平台撤销并生成新密钥，再处理文件和历史；只改当前文件、补忽略规则或改为私有，无法抹掉已有历史副本。

## 8. 常见问题

| 现象 | 处理 |
| --- | --- |
| 同学没有账号或看不到我的旅行 | Git 不同步数据库；在自己的库初始化测试数据或注册。需要同一份数据时按第 3.4 节连接同一后端 |
| 登录 500 / 就绪检查失败 | 检查 MySQL 启动状态，以及 DB_URL 端口、库名、用户名和密码是否与 Navicat 一致，查看后端日志 |
| 登录后提示过期 | JWT 有效期 24 小时；更换密钥或切换不同后端后重新登录 |
| AI / 高德未配置或超时 | 检查后端变量、服务权限 / 余额、模型 ID 和网络，修改后重启后端 |
| Git 推送认证失败 | 按上方凭据文档用 GCM 浏览器登录，确认当前账号有仓库权限 |
| 首次推送提示远程存在提交 | 检查是否创建仓库时勾选 README；先核对远程和本地内容，不要强制覆盖 |
| 切换分支提示有本地改动 | 先用 git status 查看，提交或妥善暂存，不要直接丢弃修改 |
| 拉取后前端缺依赖 | 在 frontend/ 运行 npm ci；修改依赖时同时提交 package.json 和 package-lock.json |
| 拉取后数据库缺字段 | 查看 PR 和增量 SQL；git pull 不会修改数据库，不要重复导入整套演示数据 |
| 5173 / 8080 被占用 | 关闭自己重复启动的服务，或同步修改端口与代理；前端固定端口不会自动跳到其他端口 |

日常顺序：**同步 main → 新建任务分支 → 修改和验证 → 提交 / 推送 → PR 检查合并 → 双方同步 main**。
