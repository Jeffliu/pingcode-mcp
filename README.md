# pingcode-jeff

[GitHub 源码与 Issue](https://github.com/liuzhaoren/pingcode-jeff) · [License: MIT](https://opensource.org/licenses/MIT)

本仓库为 **Jeff 维护的 PingCode MCP**（与上游 npm 包 `pingcode-mcp` 区分）。通过 Model Context Protocol 连接 PingCode：**PJM 项目 / 工作项**（浏览器 cookie）与 **开放平台 Ship**（企业令牌：产品、需求、工单）。

若你的 GitHub 地址不同，请修改 [package.json](package.json) 中的 `repository` / `homepage` / `bugs` 字段，并全局替换文档里的仓库链接。

## ✨ 功能特性

- 🔐 **便捷登录** - 支持浏览器登录和飞书等第三方登录（PJM 工具）
- 🔍 **工作项查询** - 通过编号快速查看工作项详情
- 📋 **发布管理** - 查询发布版本关联的缺陷和需求
- 🔎 **全文搜索** - 搜索项目中的工作项
- 📊 **版本列表** - 列出项目的所有发布版本
- ✏️ **状态更新** - 更新工作项的状态
- 🐛 **缺陷管理** - 更新缺陷的原因分析、解决方案和解决方法
- 🧩 **产品与工单（开放平台）** - `op_`* 工具：列产品、列需求/工单（需配置 `PINGCODE_CLIENT_ID` / `PINGCODE_CLIENT_SECRET`）

## 📦 安装

### 方式一：全局安装（推荐）

```bash
npm install -g pingcode-jeff
```

（亦可从本仓库 `npm pack` / `npm link` 安装；全局安装后 CLI 命令为 `**pingcode-jeff**`。）

安装后需要安装 Chromium 浏览器（用于登录）:

```bash
npx playwright install chromium
```

### 方式二：使用 npx（无需安装）

```bash
npx pingcode-jeff
```

首次使用会自动下载依赖。

> **说明**：在 `pingcode-jeff` 尚未发布到 npm 前，`npm install -g` / `npx -y pingcode-jeff` 可能不可用，请优先使用下文「本地构建产物」或 `npx tsx` 指向本仓库 `src/index.ts`。

## 🚀 快速开始（MCP 用户配置）

下面按 **Cursor / Claude Desktop 等通用 MCP 客户端** 说明；核心是编辑 MCP 的 JSON 配置，在 `mcpServers` 里增加一项，并填入 `command` / `args` 与 `env`。

### 配置文件放在哪里


| 客户端                         | 常见路径                                                              |
| --------------------------- | ----------------------------------------------------------------- |
| **Cursor**                  | 用户级：`~/.cursor/mcp.json`；或项目内：`<项目>/.cursor/mcp.json`             |
| **Claude Desktop（macOS）**   | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| **Claude Desktop（Windows）** | `%APPDATA%\Claude\claude_desktop_config.json`                     |


修改后一般需要 **完全重启** MCP 进程或整个客户端，新环境变量才会生效。

### 你需要哪些环境变量


| 用途                                                 | 环境变量                                          | 说明                                                                       |
| -------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| **PJM**（`login`、`list_projects`、`get_work_item` 等） | `PINGCODE_DOMAIN`                             | 你的 PingCode 访问域名，如 `acme.pingcode.com`；不配则默认 `neuralgalaxy.pingcode.com` |
| **开放平台 Ship**（`op_list_products` 等）                | `PINGCODE_CLIENT_ID`、`PINGCODE_CLIENT_SECRET` | 企业后台「凭据管理」里应用的 **客户端凭据（client_credentials）**；不配则 `op`_* 会报错              |
| 可选                                                 | `PINGCODE_OPEN_BASE_URL`                      | 默认 `https://open.pingcode.com/v1`；私有化部署时按官方文档改                           |


可同时配置 **PJM + 开放平台**，两套工具互不影响。

### 推荐：完整配置示例（全局安装 + PJM + 开放平台）

将占位符换成你自己的域名与开放平台凭据。**不要把含真实 Secret 的配置提交到 Git。**

```json
{
  "mcpServers": {
    "pingcode-jeff": {
      "command": "pingcode-jeff",
      "env": {
        "PINGCODE_DOMAIN": "your-company.pingcode.com",
        "PINGCODE_CLIENT_ID": "your-openapi-client-id",
        "PINGCODE_CLIENT_SECRET": "your-openapi-client-secret"
      }
    }
  }
}
```

### 使用 npx（不全局安装）

```json
{
  "mcpServers": {
    "pingcode-jeff": {
      "command": "npx",
      "args": ["-y", "pingcode-jeff"],
      "env": {
        "PINGCODE_DOMAIN": "your-company.pingcode.com",
        "PINGCODE_CLIENT_ID": "your-openapi-client-id",
        "PINGCODE_CLIENT_SECRET": "your-openapi-client-secret"
      }
    }
  }
}
```

### 使用本地构建产物（自己 clone 仓库开发时）

先在本仓库执行 `npm install && npm run build`，然后把 `args` 里的路径换成你机器上的 **绝对路径**：

```json
{
  "mcpServers": {
    "pingcode-jeff": {
      "command": "node",
      "args": ["/绝对路径/pingcode-jeff/dist/index.js"],
      "env": {
        "PINGCODE_DOMAIN": "your-company.pingcode.com",
        "PINGCODE_CLIENT_ID": "your-openapi-client-id",
        "PINGCODE_CLIENT_SECRET": "your-openapi-client-secret"
      }
    }
  }
}
```

开发调试也可用 `npx tsx /绝对路径/pingcode-jeff/src/index.ts`（需已 `npm install`）。

### 首次使用 PJM（浏览器登录）

1. 已安装 Chromium：`npx playwright install chromium`（与全局/npx 安装方式一致）。
2. 重启 MCP 客户端后，让 AI 调用 `**login**`，在浏览器里完成 PingCode（含飞书等）登录。
3. Cookie 会保存在 `~/.pingcode-mcp/credentials.json`。

### 首次使用开放平台（无需浏览器）

1. 在 PingCode **企业管理 → 凭据管理** 创建应用，授权方式为 **客户端凭据 / 企业令牌**，并勾选 Ship 相关产品、需求、工单的读权限。
2. 把 `PINGCODE_CLIENT_ID`、`PINGCODE_CLIENT_SECRET` 写进上面 MCP 配置的 `env`。
3. 让 AI 调用 `**op_check_auth`** 或直接使用 `**op_list_products`**：会自动请求 `client_credentials` 换令牌并缓存到 `~/.pingcode-mcp/openapi.json`。

### 开始使用（示例话术）

**PJM：**

```
请帮我登录 PingCode
```

```
查看工作项 LFY-2527 的详情
```

```
列出优点云项目的所有发布版本
```

```
查询发布版本 QxednuAG 的所有缺陷
```

**开放平台 Ship：**

```
先 op_check_auth，再 op_list_products
```

```
用 op_list_product_tickets 列出产品 xxx 下的工单，关键词填「登录」
```

```
列出某产品工单并带上关注人（include_watchers=true；列表很长时仅前 80 条会请求关注人接口）
```

## 🛠️ 可用工具


| 工具名称                         | 说明                                      | 参数                                                                                     |
| ---------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `login`                      | 打开浏览器进行登录                               | 无                                                                                      |
| `logout`                     | 退出登录，清除凭证                               | 无                                                                                      |
| `check_auth`                 | 检查登录状态                                  | 无                                                                                      |
| `get_work_item`              | 获取工作项详情                                 | `identifier`: 工作项编号（如 LFY-123）                                                         |
| `list_projects`              | 列出所有可访问项目                               | 无                                                                                      |
| `list_releases`              | 列出项目的发布版本                               | `project_id`: 项目标识（如 LFY）                                                              |
| `get_release_items`          | 获取版本关联的工作项                              | `release_id`: 版本ID `project_id`: 项目标识 `item_type`: bug/story/all                       |
| `search_work_items`          | 搜索工作项                                   | `query`: 搜索关键词 `project_id`: 项目标识（可选）                                                  |
| `update_work_item_state`     | 更新工作项状态                                 | `work_item_id`: 工作项编号 `state_name`: 目标状态                                               |
| `get_bug_field_options`      | 获取缺陷字段可选值                               | `work_item_id`: 缺陷工作项编号                                                                |
| `update_bug_fields`          | 更新缺陷的分析和解决方案                            | `work_item_id`: 工作项编号 `reason`: 原因分析（可选） `solution`: 解决方案（可选） `jiejuefangfa`: 解决方法（可选） |
| `op_logout`                  | 【开放平台】清除缓存的企业令牌                         | 无                                                                                      |
| `op_check_auth`              | 【开放平台】校验 client 凭证并换取/缓存企业令牌            | 无                                                                                      |
| `op_list_products`           | 【开放平台】列出产品（Ship）                        | 无                                                                                      |
| `op_list_product_ideas`      | 【开放平台】列出产品下需求（含**模块**列，对应 `suite.name`） | `product_id` `keywords`（可选） `include_watchers`（可选，true 时追加关注人，默认仅前 80 条各查一次）           |
| `op_list_product_tickets`    | 【开放平台】列出产品下工单（含模块列；接口无 `suite` 时为 `-`）  | `product_id` `keywords`（可选） `include_watchers`（同上）                                     |
| `op_list_product_work_items` | 【开放平台】列出产品下需求+工单（均含模块列）                 | `product_id` `include_watchers`（可选，需求/工单各最多前 80 条拉关注人）                                 |


## 💡 使用示例

### 查看工作项详情

```
查看 LFY-2527 的详情
```

### 查询发布版本的缺陷

从发布页面 URL 获取参数：

```
https://yourcompany.pingcode.com/pjm/projects/LFY/releases/QxednuAG/workitems
                                                    ↑              ↑
                                              project_id      release_id
```

然后询问 AI:

```
查询项目 LFY 的发布版本 QxednuAG 中的所有缺陷
```

### 搜索工作项

```
在优点云项目中搜索包含"登录"的工作项
```

### 更新工作项状态

```
把 LFY-2527 的状态改为已完成
```

### 更新缺陷分析字段

```
帮我更新 LFY-2527 的原因分析和解决方案
```

## 🔧 环境变量一览（与 MCP `env` 一致）

在 MCP 配置的 `env` 对象里使用下列键名即可（与上文「快速开始」对应）。

### PJM（内部 Web API，cookie）


| 变量名               | 必填  | 说明               | 默认值                         |
| ----------------- | --- | ---------------- | --------------------------- |
| `PINGCODE_DOMAIN` | 建议填 | 你的 PingCode 站点域名 | `neuralgalaxy.pingcode.com` |


### 开放平台（REST API，企业令牌 `op_*`）


| 变量名                      | 必填            | 说明                 | 默认值                            |
| ------------------------ | ------------- | ------------------ | ------------------------------ |
| `PINGCODE_CLIENT_ID`     | 使用 `op_*` 时必填 | 凭据管理中的应用 Client ID | 无                              |
| `PINGCODE_CLIENT_SECRET` | 使用 `op_*` 时必填 | 应用 Secret          | 无                              |
| `PINGCODE_OPEN_BASE_URL` | 否             | API 根路径            | `https://open.pingcode.com/v1` |


**令牌缓存**：`op_`* 首次成功换票后会写入 `~/.pingcode-mcp/openapi.json`。企业令牌约 **30 天**有效，过期后会在下次调用时自动用 `client_id`/`secret` 再换；若你在后台 **重置 Secret** 或换了应用，请更新 MCP 里的 `env` 并可选调用 `**op_logout`** 清缓存后再用 `**op_check_auth`**。

### 开放平台集成测试（真实请求）

仓库内 `[tests/openapi-ship.integration.test.ts](tests/openapi-ship.integration.test.ts)` 会校验：

1. `client_credentials` 能换取企业令牌
2. `GET /v1/ship/products` 能列出产品
3. 取**列表中第一个产品**，`GET /v1/ship/tickets` 带 `page_size=10` 能拿到至多 10 条工单

**不要**把 `client_secret` 写进仓库。任选一种方式注入凭据：

```bash
# 方式 A：环境变量
PINGCODE_CLIENT_ID=xxx PINGCODE_CLIENT_SECRET=yyy npm run test:openapi

# 方式 B：复制 tests/.env.openapi.local.example 为 tests/.env.openapi.local 并填写（该文件已被 .gitignore）
npm run test:openapi
```

未配置凭据时，整个测试套件会被 **skip**，便于 CI 无密钥场景。

## 🔨 本地开发

如果你想修改源码或为项目贡献代码：

```bash
# 克隆仓库
git clone https://github.com/liuzhaoren/pingcode-jeff.git
cd pingcode-jeff

# 安装依赖
npm install

# 安装浏览器
npx playwright install chromium

# 开发模式（实时编译）
npm run dev

# 构建
npm run build

# 测试构建产物
npm start
```

### 在 MCP 客户端中使用本地开发版本

与上文「完整配置」相同，把 `command`/`args` 换成 `tsx` 指向源码，并保留你需要的 `env`（示例含 PJM + 开放平台）：

```json
{
  "mcpServers": {
    "pingcode-jeff": {
      "command": "npx",
      "args": ["tsx", "/绝对路径/pingcode-jeff/src/index.ts"],
      "env": {
        "PINGCODE_DOMAIN": "your-company.pingcode.com",
        "PINGCODE_CLIENT_ID": "your-openapi-client-id",
        "PINGCODE_CLIENT_SECRET": "your-openapi-client-secret"
      }
    }
  }
}
```

## 📂 项目结构

```
pingcode-jeff/
├── src/
│   ├── index.ts               # MCP 服务器入口
│   ├── api/
│   │   ├── pingcode-client.ts # PJM（cookie）
│   │   └── openapi-client.ts  # 开放平台 REST
│   ├── tools/
│   │   ├── login.ts
│   │   ├── openapi-auth.ts
│   │   ├── openapi-products.ts
│   │   └── work-items.ts
│   ├── types/
│   │   └── pingcode.ts
│   └── utils/
│       ├── credentials.ts
│       └── openapi-token.ts
├── tests/
│   └── openapi-ship.integration.test.ts
├── dist/
├── package.json
├── tsconfig.json
└── README.md
```

## 🔒 隐私与安全

- PJM 登录凭证：`~/.pingcode-mcp/credentials.json`
- 开放平台令牌缓存：`~/.pingcode-mcp/openapi.json`
- 不会把上述文件上传到第三方；请求发往你的 PingCode 域名及 PingCode 开放平台域名
- **切勿**将含 `PINGCODE_CLIENT_SECRET` 的 `mcp.json` 提交到公开仓库

## ❓ 常见问题

**Q: PJM 的 cookie 凭证过期了怎么办？**  
A: 重新调用 `login` 工具完成浏览器登录。

*Q: 开放平台 `op_` 报错未配置或 401？**  
A: 检查 MCP `env` 里是否已配置 `PINGCODE_CLIENT_ID` / `PINGCODE_CLIENT_SECRET`；Secret 被重置后需更新配置，并可调用 `op_logout` 再 `op_check_auth`。

**Q: 支持哪些 MCP 客户端？**  
A: 所有支持 MCP 的客户端均可，例如 Cursor、Claude Desktop、Windsurf 等。

**Q: 能在无界面服务器或 CI 里用吗？**  
A: **仅使用 `op_`*（企业令牌）** 时不需要浏览器，适合脚本/CI。仍使用 `**login`（PJM）** 时需要本机图形界面与 Playwright 浏览器。

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**维护**: Jeff（fork 自 PingCode MCP 生态，仓库：[https://github.com/liuzhaoren/pingcode-jeff](https://github.com/liuzhaoren/pingcode-jeff)）  
**关键词**: mcp, pingcode, pingcode-jeff, model-context-protocol, ship, openapi