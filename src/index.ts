#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { login, logout, checkAuth } from './tools/login.js';
import { getWorkItem, getReleaseItems, searchWorkItems, listReleases, listProjects, updateWorkItemState, getBugFieldOptions, updateBugFields } from './tools/work-items.js';
import { opLogout, opCheckAuth } from './tools/openapi-auth.js';
import {
  listProducts as opListProducts,
  listProductIdeas as opListProductIdeas,
  listProductTickets as opListProductTickets,
  listProductWorkItems as opListProductWorkItems,
} from './tools/openapi-products.js';

// 创建 MCP 服务器
const server = new Server(
  {
    name: 'pingcode-jeff',
    version: '1.1.1',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);


// 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'login',
        description:
          '打开浏览器进行 PingCode 登录（支持飞书等第三方登录）。登录成功后凭证会自动保存。',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'logout',
        description: '退出 PingCode 登录，清除本地保存的凭证。',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'check_auth',
        description: '检查当前 PingCode 登录状态。',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'get_work_item',
        description:
          '通过 PingCode 工作项编号获取详情。支持格式：#12345、12345、LFY-123 等。',
        inputSchema: {
          type: 'object',
          properties: {
            identifier: {
              type: 'string',
              description: '工作项编号，如 #12345、12345 或 LFY-123',
            },
          },
          required: ['identifier'],
        },
      },
      {
        name: 'get_release_items',
        description:
          '获取某个发布版本关联的缺陷和需求列表。',
        inputSchema: {
          type: 'object',
          properties: {
            release_id: {
              type: 'string',
              description: '发布版本 ID（可从发布页面 URL 获取）',
            },
            project_id: {
              type: 'string',
              description: '项目标识，如 LFY',
            },
            item_type: {
              type: 'string',
              enum: ['bug', 'story', 'all'],
              description: '筛选工作项类型：bug=缺陷，story=需求，all=全部（默认）',
            },
          },
          required: ['release_id', 'project_id'],
        },
      },
      {
        name: 'search_work_items',
        description: '搜索 PingCode 工作项。',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '搜索关键词',
            },
            project_id: {
              type: 'string',
              description: '限定在某个项目中搜索（可选）',
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_releases',
        description: '列出项目的所有发布版本。用户可以通过此工具查看版本名称和对应的 ID。',
        inputSchema: {
          type: 'object',
          properties: {
            project_id: {
              type: 'string',
              description: '项目标识，如 LFY（优点云）',
            },
          },
          required: ['project_id'],
        },
      },
      {
        name: 'list_projects',
        description: '列出用户可访问的所有项目。返回项目标识和名称列表。',
        inputSchema: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
      {
        name: 'update_work_item_state',
        description: '更新工作项（缺陷/需求/任务）的状态。通过状态名称指定目标状态。',
        inputSchema: {
          type: 'object',
          properties: {
            work_item_id: {
              type: 'string',
              description: '工作项编号，如 LFY-2527',
            },
            state_name: {
              type: 'string',
              description: '目标状态名称，如 "已完成"、"进行中"、"待处理"',
            },
          },
          required: ['work_item_id', 'state_name'],
        },
      },
      {
        name: 'get_bug_field_options',
        description: '获取缺陷字段的可选值列表（原因分析、解决方案）及其 ID 映射。AI 根据修复内容判断选择哪个选项。',
        inputSchema: {
          type: 'object',
          properties: {
            work_item_id: {
              type: 'string',
              description: '缺陷工作项编号',
            },
          },
          required: ['work_item_id'],
        },
      },
      {
        name: 'update_bug_fields',
        description: '更新缺陷的原因分析、解决方案、解决方法字段。支持使用选项文本或 ID。',
        inputSchema: {
          type: 'object',
          properties: {
            work_item_id: {
              type: 'string',
              description: '工作项编号',
            },
            reason: {
              type: 'string',
              description: '原因分析（可选），使用 get_bug_field_options 返回的选项文本或 ID',
            },
            solution: {
              type: 'string',
              description: '解决方案（可选），使用 get_bug_field_options 返回的选项文本或 ID',
            },
            jiejuefangfa: {
              type: 'string',
              description: '解决方法（可选），描述具体的修复方法',
            },
          },
          required: ['work_item_id'],
        },
      },
      // ======================================================================
      // PingCode 开放平台 REST API（企业令牌 / client_credentials）
      // ======================================================================
      {
        name: 'op_logout',
        description:
          '【开放平台】清除本地缓存的企业令牌文件（~/.pingcode-mcp/openapi.json）。下次调用 op_* 时会用环境变量中的 client_id/secret 重新换取。',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'op_check_auth',
        description:
          '【开放平台】检查是否已配置 PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET；若缓存令牌过期或不存在，会尝试调用 client_credentials 换取企业令牌并写入缓存。',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'op_list_products',
        description:
          '【开放平台 / Ship 模块】列出当前用户可访问的所有产品（Product）。返回 product 标识、名称和 product_id。',
        inputSchema: { type: 'object', properties: {}, required: [] },
      },
      {
        name: 'op_list_product_ideas',
        description:
          '【开放平台 / Ship 模块】列出某个产品下的所有需求（Idea）。每条含模块列（接口 suite.name，未设置则为 -）。支持可选关键词搜索。可选 include_watchers=true 时在每条后追加关注人（额外调用 GET /v1/participants，默认仅对前 80 条拉取，避免频率限制）。',
        inputSchema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: '产品 ID（24 位 hex），可通过 op_list_products 获取',
            },
            keywords: {
              type: 'string',
              description: '搜索关键词（可选），匹配需求编号或标题',
            },
            include_watchers: {
              type: 'boolean',
              description:
                '为 true 时追加每条需求的关注人列表（默认 false）。列表超过 80 条时仅前 80 条请求关注人接口。',
            },
          },
          required: ['product_id'],
        },
      },
      {
        name: 'op_list_product_tickets',
        description:
          '【开放平台 / Ship 模块】列出某个产品下的所有工单（Ticket）。每条含模块列（若接口返回 suite 则显示名称，否则 -）。支持可选关键词搜索。可选 include_watchers=true 追加关注人（GET /v1/participants，默认最多前 80 条）。',
        inputSchema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: '产品 ID（24 位 hex），可通过 op_list_products 获取',
            },
            keywords: {
              type: 'string',
              description: '搜索关键词（可选），匹配工单编号或标题',
            },
            include_watchers: {
              type: 'boolean',
              description:
                '为 true 时追加每条工单的关注人列表（默认 false）。超过 80 条时仅前 80 条拉取关注人。',
            },
          },
          required: ['product_id'],
        },
      },
      {
        name: 'op_list_product_work_items',
        description:
          '【开放平台 / Ship 模块】一次性列出某个产品下的所有需求和工单（合并输出）。需求/工单各行均含模块列（suite）。可选 include_watchers=true 为需求/工单分别追加关注人（各最多前 80 条）。',
        inputSchema: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: '产品 ID（24 位 hex），可通过 op_list_products 获取',
            },
            include_watchers: {
              type: 'boolean',
              description:
                '为 true 时在每条需求/工单后追加关注人（默认 false）。需求与工单各自仅对前 80 条请求关注人接口。',
            },
          },
          required: ['product_id'],
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'login': {
        const result = await login();
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'logout': {
        const result = logout();
        return {
          content: [
            {
              type: 'text',
              text: result.message,
            },
          ],
          isError: !result.success,
        };
      }

      case 'check_auth': {
        const result = checkAuth();
        let text = result.message;
        if (result.authenticated && result.expiresAt) {
          text += `\n凭证过期时间: ${result.expiresAt}`;
        }
        return {
          content: [
            {
              type: 'text',
              text,
            },
          ],
          isError: !result.authenticated,
        };
      }

      case 'get_work_item': {
        const identifier = (args as { identifier: string }).identifier;
        const result = await getWorkItem(identifier);
        
        if (!result.success) {
          return {
            content: [{ type: 'text', text: `错误: ${result.error}` }],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: result.data!,
              // 结构化数据：供 MCP 客户端/模型可靠读取
              data: {
                work_item: result.workItem,
                ai_directives: result.aiDirectives,
                next_required_action: result.nextRequiredAction,
              },
            },
          ] as any,
        };
      }

      case 'get_release_items': {
        const { release_id, project_id, item_type } = args as {
          release_id: string;
          project_id: string;
          item_type?: 'bug' | 'story' | 'all';
        };
        const result = await getReleaseItems(release_id, project_id, item_type);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'search_work_items': {
        const { query, project_id } = args as {
          query: string;
          project_id?: string;
        };
        const result = await searchWorkItems(query, project_id);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'list_releases': {
        const { project_id } = args as { project_id: string };
        const result = await listReleases(project_id);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'list_projects': {
        const result = await listProjects();
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'update_work_item_state': {
        const { work_item_id, state_name } = args as {
          work_item_id: string;
          state_name: string;
        };
        const result = await updateWorkItemState(work_item_id, state_name);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'get_bug_field_options': {
        const { work_item_id } = args as { work_item_id: string };
        const result = await getBugFieldOptions(work_item_id);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      case 'update_bug_fields': {
        const { work_item_id, reason, solution, jiejuefangfa } = args as {
          work_item_id: string;
          reason?: string;
          solution?: string;
          jiejuefangfa?: string;
        };
        const result = await updateBugFields(work_item_id, reason, solution, jiejuefangfa);
        return {
          content: [
            {
              type: 'text',
              text: result.success ? result.data! : `错误: ${result.error}`,
            },
          ],
          isError: !result.success,
        };
      }

      // ===== 开放平台（企业令牌）=====
      case 'op_logout': {
        const result = opLogout();
        return {
          content: [{ type: 'text', text: result.message }],
          isError: !result.success,
        };
      }

      case 'op_check_auth': {
        const result = await opCheckAuth();
        let text = result.message;
        if (result.expiresAt) text += `\n令牌到期时间: ${result.expiresAt}`;
        return {
          content: [{ type: 'text', text }],
          isError: !result.authenticated,
        };
      }

      case 'op_list_products': {
        const result = await opListProducts();
        return {
          content: [
            { type: 'text', text: result.success ? result.data! : `错误: ${result.error}` },
          ],
          isError: !result.success,
        };
      }

      case 'op_list_product_ideas': {
        const { product_id, keywords, include_watchers } = args as {
          product_id: string;
          keywords?: string;
          include_watchers?: boolean;
        };
        const result = await opListProductIdeas(
          product_id,
          keywords,
          include_watchers === true
        );
        return {
          content: [
            { type: 'text', text: result.success ? result.data! : `错误: ${result.error}` },
          ],
          isError: !result.success,
        };
      }

      case 'op_list_product_tickets': {
        const { product_id, keywords, include_watchers } = args as {
          product_id: string;
          keywords?: string;
          include_watchers?: boolean;
        };
        const result = await opListProductTickets(
          product_id,
          keywords,
          include_watchers === true
        );
        return {
          content: [
            { type: 'text', text: result.success ? result.data! : `错误: ${result.error}` },
          ],
          isError: !result.success,
        };
      }

      case 'op_list_product_work_items': {
        const { product_id, include_watchers } = args as {
          product_id: string;
          include_watchers?: boolean;
        };
        const result = await opListProductWorkItems(
          product_id,
          include_watchers === true
        );
        return {
          content: [
            { type: 'text', text: result.success ? result.data! : `错误: ${result.error}` },
          ],
          isError: !result.success,
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: `未知工具: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `执行失败: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('pingcode-jeff MCP Server 已启动');
}

main().catch((error) => {
  console.error('启动失败:', error);
  process.exit(1);
});
