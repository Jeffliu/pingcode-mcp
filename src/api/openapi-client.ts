import axios, { AxiosError, AxiosInstance } from 'axios';
import {
  OPEN_API_BASE_URL,
  forceEnterpriseTokenRefresh,
  getValidAccessToken,
} from '../utils/openapi-token.js';
import type {
  Paginated,
  ShipIdea,
  ShipProduct,
  ShipTicket,
} from '../types/pingcode.js';

interface ListOpts {
  pageSize?: number;
  pageIndex?: number;
}

interface IdeaListOpts extends ListOpts {
  productId?: string;
  keywords?: string;
  stateId?: string;
  priorityId?: string;
}

interface TicketListOpts extends ListOpts {
  productId?: string;
  keywords?: string;
  typeId?: string;
  stateId?: string;
  priorityId?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string = OPEN_API_BASE_URL) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 20000,
      headers: { Accept: 'application/json' },
    });
  }

  /**
   * 统一请求：自动加 Bearer、401 时强制重新 client_credentials 换取令牌并重试一次、429 退避重试
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    url: string,
    params?: Record<string, any>,
    data?: any
  ): Promise<T> {
    const cleanedParams = params
      ? Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
        )
      : undefined;

    const send = async (token: string) =>
      this.client.request<T>({
        method,
        url,
        params: cleanedParams,
        data,
        headers: { Authorization: `Bearer ${token}` },
      });

    let token = await getValidAccessToken();
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        const resp = await send(token);
        return resp.data;
      } catch (e) {
        const err = e as AxiosError<any>;
        const status = err.response?.status;

        if (status === 401 && attempt === 1) {
          try {
            const refreshed = await forceEnterpriseTokenRefresh();
            token = refreshed.access_token;
            continue;
          } catch (re: any) {
            throw new Error(
              `企业令牌失效，重新换取失败（${re.message}）。请检查 PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET 或应用是否被删除/重置 Secret。`
            );
          }
        }

        if (status === 429 && attempt <= 3) {
          // 退避：1s -> 3s
          await sleep(attempt === 1 ? 1000 : 3000);
          continue;
        }

        const apiMsg =
          err.response?.data?.error?.message ||
          err.response?.data?.message ||
          err.message;
        const detail = status ? `HTTP ${status}` : 'network';
        throw new Error(`开放平台请求失败（${detail}）：${apiMsg}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 分页通用
  // -------------------------------------------------------------------------

  private async listAll<T>(
    fetchPage: (pageIndex: number, pageSize: number) => Promise<Paginated<T>>,
    pageSize = 100,
    maxPages = 20
  ): Promise<T[]> {
    const acc: T[] = [];
    for (let i = 0; i < maxPages; i++) {
      const page = await fetchPage(i, pageSize);
      const values = page.values || [];
      acc.push(...values);
      if (values.length < pageSize) break; // 已到末页
      if (acc.length >= (page.total || 0) && (page.total || 0) > 0) break;
    }
    return acc;
  }

  // -------------------------------------------------------------------------
  // 产品
  // -------------------------------------------------------------------------

  async listProducts(opts: ListOpts = {}): Promise<Paginated<ShipProduct>> {
    return this.request<Paginated<ShipProduct>>('GET', '/ship/products', {
      page_size: opts.pageSize,
      page_index: opts.pageIndex,
    });
  }

  async listAllProducts(pageSize = 100): Promise<ShipProduct[]> {
    return this.listAll<ShipProduct>(
      (pageIndex, ps) => this.listProducts({ pageIndex, pageSize: ps }),
      pageSize
    );
  }

  // -------------------------------------------------------------------------
  // 需求（idea）
  // -------------------------------------------------------------------------

  async listIdeas(opts: IdeaListOpts): Promise<Paginated<ShipIdea>> {
    return this.request<Paginated<ShipIdea>>('GET', '/ship/ideas', {
      product_id: opts.productId,
      state_id: opts.stateId,
      priority_id: opts.priorityId,
      keywords: opts.keywords,
      page_size: opts.pageSize,
      page_index: opts.pageIndex,
    });
  }

  async listAllIdeas(opts: IdeaListOpts, pageSize = 100): Promise<ShipIdea[]> {
    return this.listAll<ShipIdea>(
      (pageIndex, ps) => this.listIdeas({ ...opts, pageIndex, pageSize: ps }),
      pageSize
    );
  }

  // -------------------------------------------------------------------------
  // 工单（ticket）
  // -------------------------------------------------------------------------

  async listTickets(opts: TicketListOpts): Promise<Paginated<ShipTicket>> {
    return this.request<Paginated<ShipTicket>>('GET', '/ship/tickets', {
      product_id: opts.productId,
      type_id: opts.typeId,
      state_id: opts.stateId,
      priority_id: opts.priorityId,
      keywords: opts.keywords,
      page_size: opts.pageSize,
      page_index: opts.pageIndex,
    });
  }

  async listAllTickets(opts: TicketListOpts, pageSize = 100): Promise<ShipTicket[]> {
    return this.listAll<ShipTicket>(
      (pageIndex, ps) => this.listTickets({ ...opts, pageIndex, pageSize: ps }),
      pageSize
    );
  }
}

export const openApiClient = new OpenApiClient();
