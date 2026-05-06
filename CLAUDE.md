# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

**pingcode-jeff**：基于 Model Context Protocol (MCP) 的 PingCode 助手（Jeff 维护版，仓库 <https://github.com/liuzhaoren/pingcode-jeff>）。支持 PJM 工作项/发布、缺陷字段，以及开放平台 Ship 产品·需求·工单（企业令牌）。

## 常用命令

```bash
# 安装依赖
npm install
npx playwright install chromium  # 安装 Chromium 用于登录

# 开发模式（使用 tsx 直接运行 TypeScript）
npm run dev

# 开放平台 Ship 集成测试（需设置 PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET）
PINGCODE_CLIENT_ID=... PINGCODE_CLIENT_SECRET=... npm run test:openapi

# 构建
npm run build

# 生产模式运行
npm start
```

## 架构

```
src/
├── index.ts              # MCP 服务器入口，定义所有工具和请求处理
├── api/
│   ├── pingcode-client.ts # PingCode 内部 Web API（axios + cookie）
│   └── openapi-client.ts # PingCode 开放平台 REST API（Bearer 企业令牌）
├── tools/
│   ├── login.ts          # 登录相关（Playwright 打开浏览器进行第三方登录）
│   ├── openapi-auth.ts   # 开放平台：校验 client 凭证、清除令牌缓存
│   ├── openapi-products.ts # 开放平台：产品 / 需求 / 工单列表
│   └── work-items.ts     # 工作项查询、发布版本、搜索等功能
├── types/
│   └── pingcode.ts       # 类型定义（WorkItem、Credentials 等）
└── utils/
    ├── credentials.ts    # cookie 凭证
    └── openapi-token.ts # 企业令牌（client_credentials）缓存与换取
```

### 核心流程

1. **认证流程**: 使用 Playwright 打开浏览器让用户手动登录（支持飞书等第三方登录），登录成功后从浏览器提取 cookies 保存到 `~/.pingcode-mcp/credentials.json`
2. **API 调用**: `PingCodeClient` 使用保存的 cookies 作为认证头调用 PingCode REST API
3. **MCP 工具**: 通过 `@modelcontextprotocol/sdk` 暴露工具；其中 **PJM** 走 cookie，`op_*` 走开放平台 **企业令牌**（`PINGCODE_CLIENT_ID` + `PINGCODE_CLIENT_SECRET`，`grant_type=client_credentials`）：
  - `login` / `logout` / `check_auth` - PJM cookie 认证
  - `op_check_auth` / `op_logout` - 开放平台令牌校验与缓存清除
  - `op_list_products` / `op_list_product_ideas` / `op_list_product_tickets` / `op_list_product_work_items` - Ship 产品、需求、工单
  - `get_work_item` - 获取单个工作项详情
  - `get_release_items` - 获取发布版本关联的工作项
  - `search_work_items` - 搜索工作项
  - `list_releases` - 列出项目发布版本
  - `list_projects` - 列出可访问的项目
  - `update_work_item_state` - 更新工作项状态

### 关键常量映射

- `PRIORITY_MAP` (pingcode-client.ts): 优先级 ID → 名称（紧急/高/中/低）
- `STATE_TYPE_MAP` (work-items.ts): 状态类型数字 → 名称
- `WORK_ITEM_TYPE_MAP` (work-items.ts): 工作项类型数字 → 名称（2=需求, 3=用户故事, 5=缺陷）

## MCP 客户端配置

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

开发模式使用 `npx tsx` 代替 `node`。

## 环境变量


| 变量名               | 说明          | 默认值                         |
| ----------------- | ----------- | --------------------------- |
| `PINGCODE_DOMAIN` | PingCode 域名 | `neuralgalaxy.pingcode.com` |
| `PINGCODE_CLIENT_ID` / `PINGCODE_CLIENT_SECRET` | 开放平台企业令牌（Ship `op_*`） | 无 |
| `PINGCODE_OPEN_BASE_URL` | 开放平台 API 根路径 | `https://open.pingcode.com/v1` |


## 凭证存储

- 目录: `~/.pingcode-mcp/`
- 凭证文件: `credentials.json`（PJM cookie）
- 开放平台缓存: `openapi.json`（企业 access_token）
- Chrome 配置文件: `chrome-profile/`（保存登录状态以便复用飞书授权）
- 图片缓存: `images/`（下载的工作项图片）

