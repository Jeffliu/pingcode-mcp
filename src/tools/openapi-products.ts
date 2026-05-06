import { openApiClient } from '../api/openapi-client.js';
import type {
  ShipIdea,
  ShipProduct,
  ShipTicket,
} from '../types/pingcode.js';

interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
}

const refName = (r?: { name?: string; display_name?: string } | null) =>
  (r && (r.display_name || r.name)) || '';

// ---------------------------------------------------------------------------
// 产品列表
// ---------------------------------------------------------------------------

export async function listProducts(): Promise<ToolResult> {
  try {
    const products = await openApiClient.listAllProducts();
    if (products.length === 0) {
      return { success: true, data: '没有可访问的产品' };
    }
    const lines: string[] = [
      '# 产品列表（PingCode 开放平台 / Ship 模块）',
      '',
      `共 ${products.length} 个产品`,
      '',
      '| 标识 | 名称 | 产品ID | 描述 |',
      '| --- | --- | --- | --- |',
    ];
    for (const p of products) {
      const desc = (p.description || '').replace(/\s+/g, ' ').slice(0, 60);
      lines.push(
        `| ${p.identifier || '-'} | ${p.name || '-'} | \`${p.id}\` | ${desc} |`
      );
    }
    lines.push(
      '',
      '> 用 product_id 调 `op_list_product_work_items` 可以拿到该产品下的所有需求和工单。'
    );
    return { success: true, data: lines.join('\n') };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// 产品下的需求
// ---------------------------------------------------------------------------

export async function listProductIdeas(
  productId: string,
  keywords?: string
): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const ideas = await openApiClient.listAllIdeas({ productId, keywords });
    return { success: true, data: renderIdeasMarkdown(productId, ideas, keywords) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function renderIdeasMarkdown(
  productId: string,
  ideas: ShipIdea[],
  keywords?: string
): string {
  const head = [
    `# 需求列表 (product_id=${productId}${keywords ? ` keywords="${keywords}"` : ''})`,
    '',
    `共 ${ideas.length} 项`,
    '',
  ];
  if (!ideas.length) return head.join('\n') + '\n（无匹配项）';
  const rows = ideas.map((i) => {
    const id = i.identifier || i.id;
    const state = refName(i.state) || '-';
    const priority = refName(i.priority) || '-';
    const assignee = refName(i.assignee) || '未分配';
    return `- **${id}** ${i.title} | ${state} | ${priority} | ${assignee}`;
  });
  return [...head, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// 产品下的工单
// ---------------------------------------------------------------------------

export async function listProductTickets(
  productId: string,
  keywords?: string
): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const tickets = await openApiClient.listAllTickets({ productId, keywords });
    return { success: true, data: renderTicketsMarkdown(productId, tickets, keywords) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function renderTicketsMarkdown(
  productId: string,
  tickets: ShipTicket[],
  keywords?: string
): string {
  const head = [
    `# 工单列表 (product_id=${productId}${keywords ? ` keywords="${keywords}"` : ''})`,
    '',
    `共 ${tickets.length} 项`,
    '',
  ];
  if (!tickets.length) return head.join('\n') + '\n（无匹配项）';
  const rows = tickets.map((t) => {
    const id = t.identifier || t.id;
    const type = refName(t.type) || '-';
    const state = refName(t.state) || '-';
    const priority = refName(t.priority) || '-';
    const assignee = refName(t.assignee) || '未分配';
    return `- **${id}** ${t.title} | ${type} | ${state} | ${priority} | ${assignee}`;
  });
  return [...head, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// 产品下的需求 + 工单（一次拉完）
// ---------------------------------------------------------------------------

export async function listProductWorkItems(productId: string): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const [ideas, tickets] = await Promise.all([
      openApiClient.listAllIdeas({ productId }),
      openApiClient.listAllTickets({ productId }),
    ]);
    const lines: string[] = [
      `# 产品工作项汇总 (product_id=${productId})`,
      '',
      `共 ${ideas.length + tickets.length} 项（需求 ${ideas.length} / 工单 ${tickets.length}）`,
      '',
      `## 需求 (${ideas.length})`,
      '',
    ];
    if (ideas.length === 0) {
      lines.push('（无）');
    } else {
      for (const i of ideas) {
        const id = i.identifier || i.id;
        lines.push(
          `- **${id}** ${i.title} | ${refName(i.state) || '-'} | ${refName(i.priority) || '-'} | ${refName(i.assignee) || '未分配'}`
        );
      }
    }
    lines.push('', `## 工单 (${tickets.length})`, '');
    if (tickets.length === 0) {
      lines.push('（无）');
    } else {
      for (const t of tickets) {
        const id = t.identifier || t.id;
        lines.push(
          `- **${id}** ${t.title} | ${refName(t.type) || '-'} | ${refName(t.state) || '-'} | ${refName(t.priority) || '-'} | ${refName(t.assignee) || '未分配'}`
        );
      }
    }
    return { success: true, data: lines.join('\n') };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 兼容性导出，方便在 index.ts 集中 import
export type { ShipProduct, ShipIdea, ShipTicket };
