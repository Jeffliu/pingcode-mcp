/**
 * 开放平台 Ship 模块集成测试（真实请求 PingCode）。
 *
 * 运行前设置环境变量（勿将密钥提交到 Git）：
 *
 *   PINGCODE_CLIENT_ID=... PINGCODE_CLIENT_SECRET=... npm run test:openapi
 *
 * 可选：PINGCODE_OPEN_BASE_URL（默认 https://open.pingcode.com/v1）
 */
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { OpenApiClient } from '../src/api/openapi-client.js';
import { clearToken, fetchEnterpriseToken } from '../src/utils/openapi-token.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** 本地可选配置文件 tests/.env.openapi.local（已加入 .gitignore） */
function loadLocalEnvFile(): void {
  const p = join(__dirname, '.env.openapi.local');
  if (!existsSync(p)) return;
  const raw = readFileSync(p, 'utf-8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadLocalEnvFile();

const hasCreds = !!(
  process.env.PINGCODE_CLIENT_ID?.trim() && process.env.PINGCODE_CLIENT_SECRET?.trim()
);

describe('PingCode OpenAPI Ship（client_credentials）', { skip: !hasCreds }, () => {
  let client: OpenApiClient;

  before(() => {
    // 独立测试进程：清空旧缓存，确保走 env 中的 client_id/secret
    clearToken();
    client = new OpenApiClient();
  });

  it('应能用 client_credentials 换取企业令牌', async () => {
    const token = await fetchEnterpriseToken();
    assert.ok(token.access_token.length > 10, 'access_token 非空');
    assert.equal(token.token_type, 'Bearer');
    assert.ok(token.expires_in > 0, 'expires_in 有效');
  });

  it('应能列出产品（GET /v1/ship/products）', async () => {
    const page = await client.listProducts({ pageSize: 100, pageIndex: 0 });
    assert.ok(Array.isArray(page.values), 'values 为数组');
    assert.ok(page.values.length >= 1, '至少有一个产品');
    for (const p of page.values) {
      assert.ok(p.id, '产品含 id');
      assert.ok(p.identifier, '产品含 identifier');
      assert.ok(p.name, '产品含 name');
    }
  });

  it('应能列出第一个产品下的前 10 条工单（GET /v1/ship/tickets）', async () => {
    const products = await client.listProducts({ pageSize: 10, pageIndex: 0 });
    assert.ok(products.values.length >= 1, '需要至少一个产品以测工单');
    const productId = products.values[0].id;

    const tickets = await client.listTickets({
      productId,
      pageSize: 10,
      pageIndex: 0,
    });

    assert.ok(Array.isArray(tickets.values), '工单 values 为数组');
    assert.ok(
      tickets.values.length <= 10,
      `本页工单不超过 10 条，实际 ${tickets.values.length}`
    );
    assert.ok(
      tickets.total >= tickets.values.length,
      `total=${tickets.total} 应不小于本页条数`
    );

    for (const t of tickets.values) {
      assert.ok(t.id, '工单含 id');
      assert.ok(t.title, '工单含 title');
    }
  });
});
