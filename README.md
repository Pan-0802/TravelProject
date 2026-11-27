# Travel Planner · 个人旅行记录与智能规划系统

Vue 3 + Spring Boot + MySQL 的个人旅行管理系统，支持旅行、每日活动、景点收藏、消费预算和 AI 多轮规划。

仓库用于交付前后端源码、测试、配置模板和运行所需的数据库脚本。报告、答辩 PPT、录屏等课程材料不随源码交付。每个人在自己的电脑上安装依赖、建立数据库并配置密钥；GitHub 不会同步运行中的数据库或本机私密配置。

**收到同学的数据库 SQL 备份时，优先阅读 [数据库配置详解](#database-setup)**：连接自己的 MySQL、建空库、导入备份、填写后端配置，再启动系统。

**收到私下共享的高德 / AI Key 时，阅读 [API 配置详解](#api-setup)**：把共享的服务信息填进本机后端配置，重启后分别验证地点搜索和 AI 回复。

## 环境要求

| 工具 | 要求 |
| --- | --- |
| Java | JDK 17 或 21，配置 `JAVA_HOME` |
| Maven | 3.6.3+，命令行可运行 `mvn` |
| MySQL | 8.0.16+，使用 utf8mb4 |
| Node.js | `^20.19.0` 或 `>=22.12.0`；可按 `frontend/.nvmrc` 使用 Node 24 |
| Git / 浏览器 | Git、Chrome 或 Edge；浏览器自动化测试使用 Edge |

安装后重新打开终端，检查 `java -version`、`mvn -version`、`node -v`、`npm -v` 和 `git --version`。首次下载 Maven / npm 依赖需要联网。也可以用 `where.exe java`、`where.exe mvn`、`where.exe node` 确认命令实际指向哪个目录：装了 Maven 但没加进 `PATH` 时，`mvn` 仍然是“找不到命令”。

**Windows 上没有 JDK / Maven 时**：JDK 从 [Adoptium](https://adoptium.net/temurin/releases/) 下载 Temurin 21 的 zip，解压到纯英文路径（例如 `D:\tools\jdk-21`），把其中的 `bin` 加入 `PATH`，并设置 `JAVA_HOME` 指向该解压目录；Maven 解压后同样把 `bin` 加入 `PATH`。JDK、Maven 与 MySQL 的安装路径都避免中文和空格。

**PowerShell 里的 npm**：Windows PowerShell 的默认执行策略会禁止运行 `npm.ps1`，直接输入 `npm ci` 会报“无法加载文件 …\npm.ps1，因为在此系统上禁止运行脚本”。把命令里的 `npm` 换成 `npm.cmd` 即可，或先执行一次 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 再重新打开终端。

## 目录

```text
TravelProject/
├─ backend/
│  ├─ src/main/java/                     后端业务源码与初始化工具
│  ├─ src/main/resources/
│  │  ├─ application.yml                使用环境变量的公开配置
│  │  ├─ mapper/                        MyBatis 参数化 SQL
│  │  └─ db/mysql/
│  │     ├─ schema.sql                  新安装：完整 10 张空表
│  │     └─ upgrade-chat.sql            旧 8 表版本：新增两张聊天表
│  ├─ src/test/                         后端自动化测试
│  ├─ scripts/                          初始化、启动和验收入口
│  ├─ .env.example                      本机配置模板
│  └─ requests.http                     接口联调示例
├─ frontend/                            Vue 页面、组件、类型和浏览器测试
│  ├─ package-lock.json                 锁定依赖版本
│  └─ .env.example                      前端公开配置模板
├─ .gitignore                           排除密钥、本机配置和构建产物
└─ README.md
```

## 新电脑首次运行

以下命令使用 Windows PowerShell，除注明外均在项目根目录运行。macOS / Linux 可用 MySQL 客户端执行相同 SQL，并在终端设置环境变量后运行 Maven 和 npm。

### 1. 克隆代码

```powershell
git clone https://github.com/Pan-0802/TravelProject.git
cd TravelProject
```

私有仓库需要先取得仓库访问权限。已克隆过的电脑更新代码即可，无需重新克隆或重建数据库。

### 2. 填写本机配置

首次复制模板；已有 `.env.local` 时保留自己的配置：

```powershell
Copy-Item backend/.env.example backend/.env.local
```

编辑 `backend/.env.local`，至少填写下面四项：

```dotenv
DB_URL=jdbc:mysql://localhost:3306/travel_planner_course_demo?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
DB_USERNAME=root
DB_PASSWORD=填写自己的MySQL密码
JWT_SECRET=replace-with-at-least-32-random-bytes
```

`DB_URL` 的端口按本机 MySQL 修改，例如 `3306` 或 `3307`。MySQL 必须先启动。自动初始化入口只创建 `travel_planner_course_demo`；使用自定义数据库名时按下一节的手动方式初始化，并同步修改 `DB_URL`。

`JWT_SECRET` 示例是占位符，必须用下面生成的随机值替换，否则启动脚本会拒绝启动。

在 PowerShell 生成一次至少 32 字节的 JWT 密钥，将输出填到 `JWT_SECRET`，后续启动保持这个值：

```powershell
$jwtBytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($jwtBytes)
[Convert]::ToBase64String($jwtBytes)
```

`.env.local` 已被 Git 忽略。真实密码和 Key 不填入 `.env.example`、`application.yml` 或前端 `VITE_` 变量。

### 3. 准备数据库（两种方式选一种）

**已有同学发来的完整 SQL 备份**：按下方 [数据库配置详解](#database-setup) 建空库并导入备份，配置数据库连接后直接进入第 4 步。备份已包含结构与数据，跳过本节的空表初始化。

**希望建立全新的空系统**：首次运行下面的自动建库命令，或者按下方详解在 Navicat 中手工建库并运行 `schema.sql`：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Initialize-DemoDatabase.ps1
```

脚本读取 `.env.local`，构建后端，并使用打包在后端中的 `db/mysql/schema.sql` 创建专用数据库和完整 10 张表。需要该 MySQL 账号具有建库、建表权限；数据库已存在时默认拒绝执行，避免重复初始化。

也可以在 Navicat / MySQL 客户端中创建一个 **utf8mb4 空库**，选中该库，完整执行 [backend/src/main/resources/db/mysql/schema.sql](backend/src/main/resources/db/mysql/schema.sql)。此文件不选择数据库、不删除表，也不插入用户或业务数据。自定义库名时使用这种方式。

初始化后是空系统，**没有内置真实模式登录账号**。在页面注册自己的用户后登录。`demo_zhang / Test@123456` 仅适用于前端 Mock 演示模式。

如果使用已有完整数据库，跳过初始化。只有原来的 8 表旧版本才需要在自己的目标库执行 [upgrade-chat.sql](backend/src/main/resources/db/mysql/upgrade-chat.sql)，它只创建两张聊天表，不清空旅行和消费。已有 10 张表时不需要重复升级。

初始化中断时先查看错误，不要把重建当成普通启动步骤。确实要丢弃专用演示库数据时才使用 `-RebuildDemo`；它会删除该库的 10 张应用表后重建。

库已存在时脚本会以 `专用演示库已存在。保留数据请直接启动；确需重建时使用 -RebuildDemo 参数。` 拒绝执行，这是预期的保护，直接进入第 4 步启动后端即可。

### 4. 启动后端

在根目录执行，并保留这个终端：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Start-Backend.ps1
```

这个脚本会读取 `backend/.env.local`。直接在 IDEA 运行 `com.travel.TravelApplication` 或执行 `mvn spring-boot:run` 时，Spring Boot 不会自动读取 `.env.local`，需要在 IDE 或当前终端设置对应环境变量。

检查：

- `http://localhost:8080/health`：进程是否存活。
- `http://localhost:8080/health/ready`：数据库是否就绪，成功返回 `code: 0` 和 `data.database: UP`。

### 5. 启动前端

另开一个终端，在项目根目录运行：

```powershell
cd frontend
npm ci
npm run dev
```

PowerShell 提示 `npm.ps1` 被禁止运行时，把这两条换成 `npm.cmd ci` 和 `npm.cmd run dev`，原因见前文“环境要求”。

打开 `http://localhost:5173`。空表安装先注册自己的账号再登录；导入完整备份后使用备份中已有的系统账号和原密码登录。`npm ci` 用于首次安装或锁文件变化后；普通代码修改不必反复安装。

默认 `/api` 和 `/health` 通过 Vite 代理到本机 `8080` 后端。需要改后端地址时，复制 `frontend/.env.example` 为 `frontend/.env.development.local`，设置并重启前端：

```dotenv
VITE_API_BASE=/api
VITE_USE_MOCK=false
VITE_PROXY_TARGET=http://127.0.0.1:8080
```

<a id="database-setup"></a>

## 数据库配置详解：Navicat、完整备份与后端连接

以下步骤在接收代码和备份的同学自己的电脑上操作。统一以本机 MySQL、端口 `3306`、库名 `travel_planner_course_demo` 为例；实际端口或库名不同，按本机情况替换。

### 1. 确认 MySQL 服务正在运行

MySQL 是数据库服务，Navicat 是连接和管理数据库的客户端，两者都需要准备好。

1. 安装并启动 MySQL 8.0.16+，记住安装时设置的数据库用户名、密码和端口。
2. Windows 可按 `Win + R`，输入 `services.msc`，找到自己安装的 MySQL 服务并启动；服务名可能是 `MySQL80`，以本机安装名称为准。启动服务需要管理员授权，会弹出 UAC 确认；普通权限的终端里执行 `Start-Service MySQL80` 通常会被拒绝。
3. 有多个 MySQL 实例时，确认这次连接的是 8.0 实例对应的端口；例如旧实例占 `3306`、另一个实例占 `3307`。

MySQL 的安装目录和数据目录保持纯英文路径。中文路径下曾出现 `mysqld` 启动后立即退出、错误日志里也没有任何提示的情况；服务起不来时先把它换到纯英文路径再排查。

| 默认端口 | 用途 | 填在哪里 |
| --- | --- | --- |
| `3306`（或本机实际的 `3307`） | MySQL 数据库服务 | Navicat 连接端口、`DB_URL` |
| `8080` | Spring Boot 后端 | 前端代理、后端就绪检查 |
| `5173` | Vue 前端 | 浏览器打开的页面地址 |

### 2. 在 Navicat 新建 MySQL 连接

打开 Navicat，选择“连接 → MySQL”（部分版本为“新建连接 → MySQL”），填写：

| 连接项目 | 示例 | 说明 |
| --- | --- | --- |
| 连接名 | `我的本地MySQL8` | 只是 Navicat 中的显示名称，可以用中文 |
| 主机 | `127.0.0.1` | 连接自己电脑上的 MySQL，不填对方电脑的地址 |
| 端口 | `3306` | 与自己 MySQL 实例的端口一致 |
| 用户名 | `root` | 使用自己本机有权限的数据库账号 |
| 密码 | 自己安装 MySQL 时设置的密码 | 不是系统网页登录密码，也不是对方电脑的 MySQL 密码 |

点击“测试连接”，成功后保存并打开连接。连接失败时先检查服务、端口和密码，不要急着改项目代码。

在这个连接下新建查询，运行：

```sql
SELECT VERSION() AS mysql_version;
```

确认服务器为 MySQL 8.0.16+。Navicat 的连接名即使叫“MySQL8”，也不能证明连到的服务器就是 8.0。项目使用的 `CHECK` 约束从 MySQL 8.0.16 起才得到实际执行，参见 [MySQL CHECK 约束说明](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html)。

### 3. 建立一个新的空数据库

在 Navicat 左侧 **右键刚打开的 MySQL 连接 → 新建数据库**：

- 数据库名：`travel_planner_course_demo`。
- 字符集：`utf8mb4`。
- 排序规则：`utf8mb4_0900_ai_ci`。

保存后刷新连接，双击打开这个数据库。如果同名库里已有数据，另取新名字并同步修改后面的 `DB_URL`，不要覆盖旧库。

也可在 Navicat 查询窗口执行下面的建库语句；它和界面建库是同一个步骤，二选一即可：

```sql
CREATE DATABASE `travel_planner_course_demo`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;
```

数据库名与 Navicat 连接名不同：`DB_URL` 填的是 `travel_planner_course_demo`，而不是“我的本地MySQL8”。

### 4. 选择导入完整备份，或只建立空表

| 手里的文件 | 包含内容 | 适用情况 |
| --- | --- | --- |
| 同学私下发来的 `travel_planner_course-日期时间.sql` 完整备份 | 表结构、账号、旅行、景点、消费、聊天等现有数据 | 希望看到与发送方相同的数据 |
| 仓库的 `backend/src/main/resources/db/mysql/schema.sql` | 完整 10 张空表，不插入账号和业务数据 | 从空白系统开始使用 |
| 仓库的 `backend/src/main/resources/db/mysql/upgrade-chat.sql` | 仅增加两张聊天表 | 只用于已有的 8 表旧版本升级 |

新电脑安装时，前两种方式选一种。新空库不单独运行聊天升级脚本。

**方式 A：导入同学的完整备份（双方需要相同数据时使用）。**

1. 通过私下文件传输取得完整 `.sql` 备份，保存到自己电脑上；完整备份不随 Git 仓库提供。
2. 在 Navicat 左侧双击打开第 3 步的新空库，确认选中的是这个库。
3. **右键这个数据库 → 运行 SQL 文件**，选择收到的备份，文件编码选择 **UTF-8**。
4. 不启用“遇到错误继续 / Continue on error”，点击“开始”，检查结果中没有失败语句。
5. 完成后刷新数据库下的“表”，继续第 5 步核对导入结果。

Navicat 的运行 SQL 文件入口见 [官方导入说明](https://help.navicat.com/hc/en-us/articles/218303897-How-to-import-SQL-files-script-files-or-command-files-into-the-server)。本项目导出脚本生成的备份不固定目标库名，可在已选中的新空库中运行；如果拿到的是其他工具生成的备份，应先确认其中的 `USE` / 建库语句是否选择了正确的目标库。

完整备份已经包含建表语句，导入后直接配置并启动后端。不要再运行空库初始化、再次导入同一份数据或执行 `-RebuildDemo`。

**方式 B：只建立空表。**

在第 3 步创建的空库上“运行 SQL 文件”，选择仓库里的 `backend/src/main/resources/db/mysql/schema.sql`，使用 UTF-8 执行，然后刷新表列表。这条路径的数据库没有内置系统账号，启动前端后自行注册。

手工已经建好的空库采用上述方式即可。若使用前文的 `Initialize-DemoDatabase.ps1` 自动创建数据库，则省略 Navicat 手工建库步骤；自动脚本发现同名库已经存在时会拒绝执行。

### 5. 核对数据库、10 张表和数据

在 **刚导入的数据库** 下新建查询，运行：

```sql
SELECT DATABASE() AS current_database;
SHOW TABLES;

SELECT 'user' AS table_name, COUNT(*) AS row_count FROM `user`
UNION ALL SELECT 'trip', COUNT(*) FROM `trip`
UNION ALL SELECT 'attraction', COUNT(*) FROM `attraction`
UNION ALL SELECT 'favorite', COUNT(*) FROM `favorite`
UNION ALL SELECT 'trip_day', COUNT(*) FROM `trip_day`
UNION ALL SELECT 'itinerary_item', COUNT(*) FROM `itinerary_item`
UNION ALL SELECT 'expense', COUNT(*) FROM `expense`
UNION ALL SELECT 'ai_plan_record', COUNT(*) FROM `ai_plan_record`
UNION ALL SELECT 'ai_conversation', COUNT(*) FROM `ai_conversation`
UNION ALL SELECT 'ai_chat_message', COUNT(*) FROM `ai_chat_message`;
```

确认 `current_database` 为自己刚创建的库，表列表有上述 10 张表。空表安装时记录数为 0 是正常的；完整备份应与发送方这份备份对应的记录数一致，不能用其他日期的备份数量作比较。

完整备份导入后，如需查看已有的系统用户名，可执行：

```sql
SELECT user_id, username, nickname
FROM `user`
ORDER BY user_id;
```

这不是查看 MySQL 的 `root` 账户。应用用户的密码保存为哈希，不能直接从表中读出原密码，请向发送方确认原系统登录账号和密码。数据按应用用户隔离：注册新账号后看不到旧账号的旅行，不代表数据导入失败。

### 6. 填写后端 `.env.local`

回到项目根目录。首次复制模板；已经配置过时直接编辑现有文件，不覆盖自己的配置：

```powershell
Copy-Item backend/.env.example backend/.env.local
```

打开 `backend/.env.local`，按照 **自己 Navicat 中已经连接成功的参数** 修改：

```dotenv
DB_URL=jdbc:mysql://127.0.0.1:3306/travel_planner_course_demo?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
DB_USERNAME=root
DB_PASSWORD=替换为自己本机MySQL的密码
JWT_SECRET=replace-with-at-least-32-random-bytes
```

| 配置位置 | 要与什么一致 |
| --- | --- |
| `DB_URL` 中的 `127.0.0.1` | Navicat 的主机 |
| `DB_URL` 中的 `3306` | Navicat 的连接端口；本机为 `3307` 就改成 `3307` |
| `DB_URL` 中 `/` 后、`?` 前的库名 | 刚才实际导入的数据库名称 |
| `DB_USERNAME`、`DB_PASSWORD` | 自己 Navicat 连接成功所用的数据库账号、密码 |
| `JWT_SECRET` | 按前文方法生成的固定随机密钥，必须替换占位符 |

例如，同学的 MySQL 在 `3307`、导入库名为 `travel_planner_course`，只需把该行改为：

```dotenv
DB_URL=jdbc:mysql://127.0.0.1:3307/travel_planner_course?useUnicode=true&characterEncoding=UTF-8&serverTimezone=Asia/Shanghai
```

文件保存为 UTF-8，确认名称确实是 `.env.local`，不是 `.env.local.txt`。每行格式为 `变量名=值`，不写 PowerShell 的 `$env:`，不加行尾分号或密码后的行内注释。JWT 填的是随机签名密钥，不是登录接口返回的 `accessToken`，普通重启保持同一密钥。

数据库配置只保存在自己的本机文件中，已被 Git 忽略。AI / 高德 Key 和 JWT 密钥不随应用库备份自动设置，按后面的可选服务配置分别填写。

### 7. 启动后端并检查连接

从项目根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Start-Backend.ps1
```

保留运行窗口，在浏览器打开 `http://localhost:8080/health/ready`，或者另开终端运行：

```powershell
Invoke-RestMethod 'http://localhost:8080/health/ready' | ConvertTo-Json -Depth 5
```

正常结果如下，JSON 字段顺序可能不同：

```json
{
  "code": 0,
  "message": "success",
  "data": {
    "status": "UP",
    "database": "UP"
  }
}
```

这个检查验证数据库连接和用户表可以查询；完整 10 表仍以第 5 步核对为准。成功后按前文启动前端：导入完整备份时用原系统账号登录，空表安装时先注册。

如果直接点 IDEA 的绿色运行按钮，应在 `TravelApplication` 的运行配置中设置相同的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 和 `JWT_SECRET`。IDEA / 直接 Maven 启动不会自动读取 `.env.local`；Navicat 中修改连接也不会自动修改后端配置。改动连接配置后重启后端。

### 8. 发送方如何重新导出最新数据

拥有现有数据的一方，在配置好 `.env.local` 后，从根目录执行（需要 MySQL 8.x 客户端）：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Export-Database.ps1
```

如果原电脑只在 IDEA 的 `TravelApplication` 中保存了数据库配置，使用：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Export-Database.ps1 -UseIdeaConfiguration
```

脚本只读源数据库，导出全部结构和数据，结果默认在 `backend/backups/数据库名-日期时间.sql`。该目录已被 Git 忽略；数据库连接密码不写入命令行或 SQL。若 MySQL 客户端安装在其他位置，可加 `-MysqlDumpPath '自己的MySQL8目录/bin/mysqldump.exe'`。

脚本用 `--result-file` 输出备份，避免 PowerShell 的 `>` 重定向把文件转换成不合适的编码，详见 [MySQL 备份说明](https://dev.mysql.com/doc/refman/8.0/en/mysqldump.html)。

将生成的 SQL 私下发给同学，按以上步骤导入新的空库。备份包含应用账号哈希和聊天内容，只与获准使用这些数据的人共享。双方导入后各有一份数据库，后续数据修改不会自动同步；需要新快照时重新导出。

### 9. 常见数据库错误

| 提示或现象 | 检查方法 |
| --- | --- |
| `Connection refused` / `Communications link failure` | 先用 Navicat 测试连接；检查 MySQL 服务、主机和实际端口 |
| `Access denied for user` | 检查本机 MySQL 用户名、密码及访问权限；不要填系统网页登录密码 |
| `Unknown database` | 核对 `DB_URL` 的库名与 Navicat 实际库名；连接显示名称不能当库名 |
| `Table ... doesn't exist` | 确认查询和后端连接的是导入目标库，核对是否有完整 10 张表 |
| `Unknown collation: utf8mb4_0900_ai_ci` | 运行 `SELECT VERSION()`，确认连到 MySQL 8.0 实例的正确端口，而不是旧实例 |
| `Table ... already exists` / `Duplicate entry` | 确认是否把完整备份导入了非空库；保留已有数据，改用新的空库导入 |
| 中文数据乱码 | 核对库字符集为 utf8mb4、运行 SQL 文件时选 UTF-8；从原备份在新空库重新导入，不只改页面编码 |
| `/health/ready` 是 UP，但看不到原旅行 | 检查库名和实际登录的应用账号；新注册账号的数据与旧账号隔离 |
| 多轮聊天提示数据库未升级 | 核对两张聊天表；只有 8 表旧库需要 `upgrade-chat.sql`，完整备份或新建 10 表不需要 |
| MySQL 服务启动后立即停止，错误日志没有内容 | 检查安装目录和数据目录是否含中文或空格；换到纯英文路径后重新初始化 |
| 重复运行初始化脚本报 `专用演示库已存在` | 预期拒绝；已有库直接启动后端，确需重建才加 `-RebuildDemo` |

SQL 执行出现错误时先查看第一条失败信息，不选择忽略错误继续执行。应用程序一般优先读取启动时的环境变量；排查时修改实际使用的 `.env.local` 或 IDEA 运行配置，而不只改 `application.yml` 的默认值。

<a id="api-setup"></a>

## API 配置详解：私下共享的高德与 AI Key

两个人可以各自在自己的电脑上运行项目，使用提供者授权共享的 API Key。无需在同一个地点或使用同一台电脑；每个人的后端通过自己的网络访问高德和模型服务。

源码从 GitHub 获取、数据库备份私下导入、API 信息私下接收，这三件事分别完成。下面所有 Key 都是占位说明，真实值只填在接收者自己的后端本地配置中。

### 1. 发送方需要私下提供哪些信息

| 变量 | 接收者需要拿到的内容 | 填写注意 |
| --- | --- | --- |
| `AMAP_KEY` | 高德开放平台的 **Web 服务** 类型 Key | 供后端地点搜索使用，填写 Key 原文 |
| `AI_API_KEY` | 模型服务的 API Key | 填密钥原文，不在前面加 `Bearer ` |
| `AI_BASE_URL` | 与这把 AI Key 配套的 OpenAI 兼容 API 根地址 | 使用提供者已经验证过的地址 |
| `AI_MODEL` | 这把 Key 实际可调用的模型 ID | 使用接口模型列表的 `id`，不是模型展示名称 |

请把 AI 的后三项作为一组信息一起交接，避免只拿到 Key，却填了其他服务商的地址或模型。两个人共用服务账号的配额和余额，提供者更新或撤销 Key 后，接收者也需要更新本机配置。

数据库地址、数据库密码、`JWT_SECRET` 按接收者本机配置，参考前面的数据库章节；共享 API 时只需要提供上面对应服务的信息。

### 2. 推荐方式：在 `.env.local` 中填写

在接收者的项目根目录操作。首次没有本地配置文件时才复制模板：

```powershell
if (-not (Test-Path backend/.env.local)) {
    Copy-Item backend/.env.example backend/.env.local
}
```

用 IDEA、VS Code 或文本编辑器打开 `backend/.env.local`。保留已经填好的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD` 和 `JWT_SECRET`，找到并修改下面四行，每个变量保留一行：

```dotenv
AMAP_KEY=替换为私下收到的高德Web服务Key
AI_API_KEY=替换为私下收到的AI密钥
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-flash
```

上面以 **DeepSeek 官方服务** 为例。使用其他服务商或兼容服务时，`AI_BASE_URL` 和 `AI_MODEL` 都按发送方提供的信息填写。官方地址及调用格式见 [DeepSeek 接入说明](https://api-docs.deepseek.com/)；模型是否可用以接收时的账号权限和模型列表为准。

本项目后端会在 `AI_BASE_URL` 后调用 `/chat/completions`，因此这里填 API 根地址，不能把完整的 `/chat/completions` 请求地址重复填进去。服务商要求带 `/v1` 前缀时，保留提供者给出的这个前缀。

填写时确认：

- 把 Key 占位说明替换为真实值，只复制密钥本身，避免带入空格、换行或聊天软件的说明文字。
- 保存为 UTF-8，文件名为 `backend/.env.local`，每行使用 `变量名=值`，不加行尾分号。
- 配置保存在后端。前端的 `.env` 只放页面和代理配置，`AMAP_KEY`、`AI_API_KEY` 都不放进 `VITE_` 变量。
- `.env.example` 是公开模板，真实值保留在 `.env.local`。仓库的 `.gitignore` 已忽略本地配置。

从根目录启动后端：

```powershell
powershell -ExecutionPolicy Bypass -File backend/scripts/Start-Backend.ps1
```

这个启动脚本会加载 `.env.local`。修改 Key、根地址或模型 ID 后，先停止自己原来的后端进程，再重新执行启动命令；只刷新前端页面不会让运行中的后端重新读取这些配置。

### 3. IDEA 绿色运行按钮的配置方式

如果通过 IDEA 运行 `com.travel.TravelApplication`，在 IDEA 中单独设置环境变量：

1. 打开 **Run → Edit Configurations**（运行 → 编辑配置）。
2. 选择 **Spring Boot → TravelApplication**；如果尚未创建，可先从主类运行一次，再回来编辑。
3. 点击 **Modify options → Environment variables**，打开环境变量编辑窗口；已有该字段时直接编辑。
4. 逐项添加 `AMAP_KEY`、`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`，值按前表填写。
5. 同时确认此运行配置中的 `DB_URL`、`DB_USERNAME`、`DB_PASSWORD`、`JWT_SECRET` 是接收者自己的有效配置。
6. 保存到本机运行配置，保持 **Store as project file** 未选中，点击 Apply / OK，停止旧后端再运行。

IDEA 的相关选项见 [Spring Boot 运行配置说明](https://www.jetbrains.com/help/idea/run-debug-configuration-spring-boot.html)。直接点绿色运行按钮时不会自动执行仓库的 `.env.local` 加载脚本；如果改的是 `.env.local`，请使用第 2 节的启动方式，或同步更新真正使用的 IDEA 环境变量。

两种启动方式按自己习惯选择，排查问题时先确认当前使用的是哪一种，修改实际生效的那份配置。

### 4. 高德 Key 在另一台电脑上的注意事项

本项目使用服务端的 **Web 服务 API** 搜索地点。提供者应共享适用于此平台的 Key；JavaScript API 的 Key、安全密钥等不能直接代替这里的 `AMAP_KEY`。对应接口见 [高德地点搜索文档](https://lbs.amap.com/api/webservice/guide/api/newpoisearch)。

如果提供者为 Key 设置了 IP 白名单，需要在高德控制台允许接收者 **运行后端的电脑所使用的公网出口 IP**。两人不在同一个网络时，出口 IP 往往不同；这里与 Navicat 的 `127.0.0.1`、前端的 `localhost:5173` 不是同一个配置。

遇到 `10005 / INVALID_USER_IP` 时，由有权限管理 Key 的提供者核对、更新白名单。Key 平台不匹配可能出现 `10009 / USERKEY_PLAT_NOMATCH`。相关含义见 [高德错误码说明](https://lbs.amap.com/api/webservice/guide/tools/info) 和 [IP 白名单说明](https://lbs.amap.com/faq/webservice/webservice-api/basic-configuration/43238)。

### 5. 怎样确认 AI 模型 ID

优先使用发送方已经验证过的 `AI_BASE_URL` 和 `AI_MODEL`。需要查询 DeepSeek 或提供 `/models` 接口的兼容服务时，在项目根目录的 **PowerShell 终端**执行下面整段命令。它从 `.env.local` 读取 Key，仅显示模型 ID 和名称，不把真实 Key 写到命令中。只在 IDEA 中配置过环境变量的同学，可先把这几项 API 信息填入本机 `.env.local` 再查询：

```powershell
powershell -ExecutionPolicy Bypass -Command {
    . ./backend/scripts/Read-LocalEnvironment.ps1 -EnvironmentFile ./backend/.env.local
    if (-not $env:AI_API_KEY -or -not $env:AI_BASE_URL) {
        throw '请先在 backend/.env.local 填写 AI_API_KEY 和 AI_BASE_URL'
    }
    $headers = @{ Authorization = 'Bearer ' + $env:AI_API_KEY }
    $models = Invoke-RestMethod -Method Get -TimeoutSec 20 `
        -Uri ($env:AI_BASE_URL.TrimEnd('/') + '/models') `
        -Headers $headers
    $models.data | Select-Object id, name
}
```

选择一个服务支持的模型，将其 `id` 原样填到 `AI_MODEL`，保存并重启后端。模型展示名称和调用 ID 可能不同；接口格式见 [DeepSeek 模型列表文档](https://api-docs.deepseek.com/api/list-models/)。

本项目使用 Chat Completions 和 JSON 响应格式。模型列表能读取不代表每个模型都支持这些能力；兼容服务若没有 `/models` 接口，按其控制台或发送方已经验证的模型 ID 配置，再用实际页面验证。

### 6. 重启后怎样验证配置有效

先按数据库章节确认后端就绪，再启动前端并登录自己的有效系统账号。`/health/ready` 的成功只证明数据库就绪，不能证明高德或 AI Key 有效。

**验证高德：**

1. 进入“景点探索”。
2. 输入一个常见关键词，例如“博物馆”，选择“北京市”，点击搜索。
3. 能看到真实地点名称和地址列表，即可确认这次高德请求成功。搜索本身不会把结果写入本地景点表。

**验证 AI：**

1. 进入“AI 智能规划”，选择目的地、一天的出行日期和预算。
2. 创建规划会话，发送一句“请生成一天的旅行方案，只安排两个活动”。
3. 等待旅行助手的实际回复和右侧草稿方案出现。

一次真实生成会使用共享账号的调用额度，并在应用数据库记录会话。HTTP 202 只是后台受理，不代表模型已经生成成功；等待过程中可刷新会话查看状态，避免反复发送相同生成请求。

接口联调也可使用 `backend/requests.http`。使用自己的系统登录 Token 调用本项目接口；高德 / AI Key 由后端读取，不填写到这些请求的 `Authorization` 中。

### 7. 常见 API 配置问题

| 提示或现象 | 对应检查 |
| --- | --- |
| “高德服务未配置” / “AI 服务未配置 API Key” | 核对变量名、值是否为空，以及当前启动方式是否加载了相应配置；重启后端 |
| 改了 `.env.local` 仍使用旧 Key | 确认不是在运行另一份 IDEA 配置或旧后端进程，更新实际生效的配置后重启 |
| 高德配置或权限不可用，包含 `10005` | 提供者核对接收者后端的公网出口 IP 是否获准 |
| 高德配置或权限不可用，包含 `10009` | 核对共享的是 Web 服务平台对应的 Key |
| AI 外部服务请求失败，页面可能显示 502 | 一起核对 Key、服务商根地址、模型 ID、权限和账户余额；本系统会包装上游错误，不一定直接显示上游状态码 |
| 模型列表不存在或服务商报模型不存在 | 核对服务商是否提供 `/models`，以及 `AI_MODEL` 是否为实际可调用的 `id` |
| 429 / 查询过于频繁 / 额度不可用 | 检查共享账号的配额和并发调用，等待后减少重复请求 |
| AI 回复超时 / 504 | 检查本机到服务商的网络，先刷新会话确认状态，再决定是否重试 |
| 本系统接口返回 401 或要求重新登录 | 先处理应用登录 Token；它与 `AI_API_KEY`、`JWT_SECRET` 是不同用途的值 |
| 配置文件在同学克隆后没有出现 | `.env.local` 有意不上传，每个人复制模板后在本机填写私下收到的值 |

未配置外部 Key 时，注册、登录、旅行、手动景点、收藏、行程、消费和统计仍可使用。实时地点搜索和新 AI 回复需要有效服务配置。AI 结果是建议，确认保存才写入正式行程，预计费用与实际消费分开记录；系统不提供距离估算或实时导航。

## 构建与验证

```powershell
# 根目录：后端独立测试，不依赖日常 MySQL 或真实 AI
mvn -f backend/pom.xml test

# 根目录：后端打包，数据库 SQL 随 JAR 一同打包
mvn -f backend/pom.xml -DskipTests package

# 根目录：前端类型检查和生产构建
npm --prefix frontend run build

# 根目录：受控浏览器场景，不调用付费模型，需要已安装 Edge
npm --prefix frontend run test:e2e -- boundaries.spec.ts conversation.spec.ts course-compliance.spec.ts
```

真实 MySQL 验收从 `backend/` 运行 `scripts/Test-MysqlAcceptance.ps1`，使用固定隔离测试库，结束后只清理本次创建的测试库。真实 AI 测试需要显式启用 `RUN_LIVE_AI=true` 或验收脚本的 `-RunLiveAi`，会创建测试数据并可能产生费用。

上面的 `npm` 命令在 Windows PowerShell 里若因执行策略无法运行，把 `npm` 换成 `npm.cmd`。

`npm run build` 会先跑 `vue-tsc` 全量类型检查再打包；较慢的 Windows 机器上类型检查可能持续数分钟且没有中间输出，属正常现象。想确认是否卡住，可单独执行 `npm run type-check`。

浏览器截图和运行报告写入已忽略的 `test-results/` / `playwright-report/`，不会重新生成课程提交材料目录。

前端 `dist/` 和后端 `target/` 是构建产物，不提交 Git。公开部署时，为前端配置静态站点、SPA 路由回退及 `/api` 反向代理；后端用环境变量启动 JAR，配置自己的数据库和 HTTPS。Vite 的 `dev` / `preview` 用于本机开发和预览。

## 两人同步代码

约定 `main` 保存可运行版本。在工作已提交的情况下，开始修改前执行：

```powershell
git switch main
git pull --ff-only origin main
```

修改和验证后，在根目录提交：

```powershell
git add -A
git commit -m "说明本次修改"
git push origin main
```

`git add -A` 包含新增、修改和删除，不包含 Git 已忽略的文件。推送提示 `fetch first` 时，先 `git fetch origin`、`git merge --no-edit origin/main`，处理并提交冲突后再推送；不要覆盖同学的提交。改数据库结构时提供增量 SQL 和对应执行说明，不要求其他人重建已有数据库。

## 常见问题

| 现象 | 处理 |
| --- | --- |
| `mvn` / `java` 找不到 | 配置 Maven 的 PATH、JDK 的 `JAVA_HOME`，重新打开终端；用 `where.exe mvn` 确认指向 |
| `npm` 报“无法加载文件 …npm.ps1，因为在此系统上禁止运行脚本” | 把 `npm` 换成 `npm.cmd`，或 `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` 后重开终端 |
| MySQL 服务在 `services.msc` 里启动失败 | 启动服务需要管理员授权；以管理员身份打开 `services.msc` 再启动 |
| 数据库连接失败 | 确认 MySQL 已启动、端口和密码正确，`DB_URL` 的库已初始化 |
| 缺少 `JWT_SECRET` | 填写 `.env.local`，使用启动脚本；IDE 启动须单独配置环境变量 |
| 新电脑不能用原账号登录 | 数据库没有随 Git 同步；新库请自行注册 |
| 前端提示无法连接后端 | 先检查后端 `/health/ready`，再检查 `VITE_PROXY_TARGET` |
| 5173 / 8080 被占用 | 使用已有服务或关闭自己此前启动的服务；改端口时同步代理和 CORS |
| 多轮聊天提示表未升级 | 旧 8 表数据库执行后端的 `upgrade-chat.sql`；新安装已包含聊天表 |
| 高德或 AI 提示未配置 | 在后端填写相应 Key 后重启后端 |

更多开发说明见 [后端 README](backend/README.md) 和 [前端 README](frontend/README.md)。
