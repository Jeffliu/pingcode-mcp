import { openApiClient } from '../api/openapi-client.js';
import type {
  ParticipantRow,
  ShipIdea,
  ShipProduct,
  ShipTicket,
} from '../types/pingcode.js';

/** 开启关注人时最多为多少条工作项各请求一次 participants（防刷爆频率限制） */
const INCLUDE_WATCHERS_MAX_ITEMS = 80;
/** 并发拉取关注人 */
const WATCHERS_CONCURRENCY = 5;

interface ToolResult {
  success: boolean;
  data?: string;
  error?: string;
}

const refName = (r?: { name?: string; display_name?: string } | null) =>
  (r && (r.display_name || r.name)) || '';

function formatParticipantsSummary(values: ParticipantRow[]): string {
  if (!values?.length) return '无';
  const parts: string[] = [];
  for (const v of values) {
    if (v.type === 'user' && v.user) {
      parts.push(v.user.display_name || v.user.name || v.user.id);
    } else if (v.type === 'user_group' && v.user_group) {
      parts.push(`[组]${v.user_group.name || v.user_group.id}`);
    } else {
      parts.push(v.id);
    }
  }
  return parts.join('、');
}

/**
 * 按 principal id 批量拉取关注人展示串（Map: principalId -> 展示文本）
 */
async function fetchWatchersMap(
  principalIds: string[],
  principalType: 'idea' | 'ticket',
  maxItems: number,
  concurrency: number
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const slice = principalIds.slice(0, maxItems);
  for (let i = 0; i < slice.length; i += concurrency) {
    const chunk = slice.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (id) => {
        try {
          const page = await openApiClient.listParticipants(principalType, id, {
            pageSize: 100,
            pageIndex: 0,
          });
          map.set(id, formatParticipantsSummary(page.values || []));
        } catch {
          map.set(id, '（获取失败）');
        }
      })
    );
  }
  return map;
}

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
  keywords?: string,
  includeWatchers?: boolean
): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const ideas = await openApiClient.listAllIdeas({ productId, keywords });
    let watchers: Map<string, string> | undefined;
    if (includeWatchers && ideas.length) {
      watchers = await fetchWatchersMap(
        ideas.map((i) => i.id),
        'idea',
        INCLUDE_WATCHERS_MAX_ITEMS,
        WATCHERS_CONCURRENCY
      );
    }
    return {
      success: true,
      data: renderIdeasMarkdown(productId, ideas, keywords, includeWatchers, watchers),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function renderIdeasMarkdown(
  productId: string,
  ideas: ShipIdea[],
  keywords?: string,
  includeWatchers?: boolean,
  watchers?: Map<string, string>
): string {
  const head = [
    `# 需求列表 (product_id=${productId}${keywords ? ` keywords="${keywords}"` : ''}${includeWatchers ? ' include_watchers=true' : ''})`,
    '',
    `共 ${ideas.length} 项`,
    '',
  ];
  if (!ideas.length) return head.join('\n') + '\n（无匹配项）';
  if (includeWatchers && ideas.length > INCLUDE_WATCHERS_MAX_ITEMS) {
    head.push(
      `> 关注人：仅对前 **${INCLUDE_WATCHERS_MAX_ITEMS}** 条请求了 \`/v1/participants\`（共 ${ideas.length} 条），避免触发频率限制。可用 \`keywords\` 缩小列表或关闭 \`include_watchers\`。`,
      ''
    );
  }
  const rows = ideas.map((i, idx) => {
    const id = i.identifier || i.id;
    const mod = refName(i.suite) || '-';
    const state = refName(i.state) || '-';
    const priority = refName(i.priority) || '-';
    const assignee = refName(i.assignee) || '未分配';
    let line = `- **${id}** ${i.title} | ${mod} | ${state} | ${priority} | ${assignee}`;
    if (includeWatchers) {
      const w = watchers?.get(i.id);
      if (w !== undefined) line += ` | 关注人: ${w}`;
      else if (ideas.length > INCLUDE_WATCHERS_MAX_ITEMS && idx >= INCLUDE_WATCHERS_MAX_ITEMS) {
        line += ` | 关注人: （未拉取，仅前 ${INCLUDE_WATCHERS_MAX_ITEMS} 条）`;
      }
    }
    return line;
  });
  return [...head, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// 产品下的工单
// ---------------------------------------------------------------------------

export async function listProductTickets(
  productId: string,
  keywords?: string,
  includeWatchers?: boolean
): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const tickets = await openApiClient.listAllTickets({ productId, keywords });
    let watchers: Map<string, string> | undefined;
    if (includeWatchers && tickets.length) {
      watchers = await fetchWatchersMap(
        tickets.map((t) => t.id),
        'ticket',
        INCLUDE_WATCHERS_MAX_ITEMS,
        WATCHERS_CONCURRENCY
      );
    }
    return {
      success: true,
      data: renderTicketsMarkdown(productId, tickets, keywords, includeWatchers, watchers),
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

function renderTicketsMarkdown(
  productId: string,
  tickets: ShipTicket[],
  keywords?: string,
  includeWatchers?: boolean,
  watchers?: Map<string, string>
): string {
  const head = [
    `# 工单列表 (product_id=${productId}${keywords ? ` keywords="${keywords}"` : ''}${includeWatchers ? ' include_watchers=true' : ''})`,
    '',
    `共 ${tickets.length} 项`,
    '',
  ];
  if (!tickets.length) return head.join('\n') + '\n（无匹配项）';
  if (includeWatchers && tickets.length > INCLUDE_WATCHERS_MAX_ITEMS) {
    head.push(
      `> 关注人：仅对前 **${INCLUDE_WATCHERS_MAX_ITEMS}** 条请求了 \`/v1/participants\`（共 ${tickets.length} 条），避免触发频率限制。`,
      ''
    );
  }
  const rows = tickets.map((t, idx) => {
    const id = t.identifier || t.id;
    const mod = refName(t.suite) || '-';
    const type = refName(t.type) || '-';
    const state = refName(t.state) || '-';
    const priority = refName(t.priority) || '-';
    const assignee = refName(t.assignee) || '未分配';
    let line = `- **${id}** ${t.title} | ${mod} | ${type} | ${state} | ${priority} | ${assignee}`;
    if (includeWatchers) {
      const w = watchers?.get(t.id);
      if (w !== undefined) line += ` | 关注人: ${w}`;
      else if (tickets.length > INCLUDE_WATCHERS_MAX_ITEMS && idx >= INCLUDE_WATCHERS_MAX_ITEMS) {
        line += ` | 关注人: （未拉取，仅前 ${INCLUDE_WATCHERS_MAX_ITEMS} 条）`;
      }
    }
    return line;
  });
  return [...head, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// 产品下的需求 + 工单（一次拉完）
// ---------------------------------------------------------------------------

export async function listProductWorkItems(
  productId: string,
  includeWatchers?: boolean
): Promise<ToolResult> {
  if (!productId) return { success: false, error: '缺少参数 product_id' };
  try {
    const [ideas, tickets] = await Promise.all([
      openApiClient.listAllIdeas({ productId }),
      openApiClient.listAllTickets({ productId }),
    ]);

    let ideaWatchers: Map<string, string> | undefined;
    let ticketWatchers: Map<string, string> | undefined;
    if (includeWatchers) {
      if (ideas.length) {
        ideaWatchers = await fetchWatchersMap(
          ideas.map((i) => i.id),
          'idea',
          INCLUDE_WATCHERS_MAX_ITEMS,
          WATCHERS_CONCURRENCY
        );
      }
      if (tickets.length) {
        ticketWatchers = await fetchWatchersMap(
          tickets.map((t) => t.id),
          'ticket',
          INCLUDE_WATCHERS_MAX_ITEMS,
          WATCHERS_CONCURRENCY
        );
      }
    }

    const lines: string[] = [
      `# 产品工作项汇总 (product_id=${productId}${includeWatchers ? ' include_watchers=true' : ''})`,
      '',
      `共 ${ideas.length + tickets.length} 项（需求 ${ideas.length} / 工单 ${tickets.length}）`,
      '',
      `## 需求 (${ideas.length})`,
      '',
    ];
    if (includeWatchers && ideas.length > INCLUDE_WATCHERS_MAX_ITEMS) {
      lines.push(
        `> 关注人：需求仅对前 **${INCLUDE_WATCHERS_MAX_ITEMS}** 条拉取（共 ${ideas.length} 条）。`,
        ''
      );
    }
    if (ideas.length === 0) {
      lines.push('（无）');
    } else {
      ideas.forEach((i, idx) => {
        const id = i.identifier || i.id;
        let row = `- **${id}** ${i.title} | ${refName(i.suite) || '-'} | ${refName(i.state) || '-'} | ${refName(i.priority) || '-'} | ${refName(i.assignee) || '未分配'}`;
        if (includeWatchers) {
          const w = ideaWatchers?.get(i.id);
          if (w !== undefined) row += ` | 关注人: ${w}`;
          else if (ideas.length > INCLUDE_WATCHERS_MAX_ITEMS && idx >= INCLUDE_WATCHERS_MAX_ITEMS) {
            row += ` | 关注人: （未拉取，仅前 ${INCLUDE_WATCHERS_MAX_ITEMS} 条）`;
          }
        }
        lines.push(row);
      });
    }
    lines.push('', `## 工单 (${tickets.length})`, '');
    if (includeWatchers && tickets.length > INCLUDE_WATCHERS_MAX_ITEMS) {
      lines.push(
        `> 关注人：工单仅对前 **${INCLUDE_WATCHERS_MAX_ITEMS}** 条拉取（共 ${tickets.length} 条）。`,
        ''
      );
    }
    if (tickets.length === 0) {
      lines.push('（无）');
    } else {
      tickets.forEach((t, idx) => {
        const id = t.identifier || t.id;
        let row = `- **${id}** ${t.title} | ${refName(t.suite) || '-'} | ${refName(t.type) || '-'} | ${refName(t.state) || '-'} | ${refName(t.priority) || '-'} | ${refName(t.assignee) || '未分配'}`;
        if (includeWatchers) {
          const w = ticketWatchers?.get(t.id);
          if (w !== undefined) row += ` | 关注人: ${w}`;
          else if (tickets.length > INCLUDE_WATCHERS_MAX_ITEMS && idx >= INCLUDE_WATCHERS_MAX_ITEMS) {
            row += ` | 关注人: （未拉取，仅前 ${INCLUDE_WATCHERS_MAX_ITEMS} 条）`;
          }
        }
        lines.push(row);
      });
    }
    return { success: true, data: lines.join('\n') };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// 兼容性导出，方便在 index.ts 集中 import
export type { ShipProduct, ShipIdea, ShipTicket };
