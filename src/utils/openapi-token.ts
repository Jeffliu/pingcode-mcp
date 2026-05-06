import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import type { OpenApiToken } from '../types/pingcode.js';

// ---------------------------------------------------------------------------
// 配置（环境变量）— 企业令牌 client_credentials
// ---------------------------------------------------------------------------

export const OPEN_API_BASE_URL =
  process.env.PINGCODE_OPEN_BASE_URL || 'https://open.pingcode.com/v1';

export const CLIENT_ID = process.env.PINGCODE_CLIENT_ID || '';
export const CLIENT_SECRET = process.env.PINGCODE_CLIENT_SECRET || '';

// ---------------------------------------------------------------------------
// 文件存储（缓存 access_token，减少 /auth/token 调用）
// ---------------------------------------------------------------------------

const STORE_DIR = path.join(os.homedir(), '.pingcode-mcp');
const STORE_FILE = path.join(STORE_DIR, 'openapi.json');

function ensureDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true, mode: 0o700 });
  }
}

export function saveToken(token: OpenApiToken): void {
  ensureDir();
  fs.writeFileSync(STORE_FILE, JSON.stringify(token, null, 2), { mode: 0o600 });
}

export function loadToken(): OpenApiToken | null {
  try {
    if (!fs.existsSync(STORE_FILE)) return null;
    return JSON.parse(fs.readFileSync(STORE_FILE, 'utf-8')) as OpenApiToken;
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    if (fs.existsSync(STORE_FILE)) fs.unlinkSync(STORE_FILE);
  } catch {
    // ignore
  }
}

export function getTokenFilePath(): string {
  return STORE_FILE;
}

// ---------------------------------------------------------------------------
// 过期判定
// ---------------------------------------------------------------------------

/** 提前 60s 视为过期，避免边界 401 */
const EXPIRY_BUFFER_MS = 60 * 1000;

export function isTokenExpired(token: OpenApiToken | null): boolean {
  if (!token || !token.access_token) return true;
  const expiresAt = token.obtained_at + token.expires_in * 1000;
  return expiresAt - EXPIRY_BUFFER_MS <= Date.now();
}

export function assertCredentialsConfigured(): void {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error(
      '未配置 PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET 环境变量。' +
        '请到 PingCode 后台「凭据管理」创建应用（企业令牌 / client_credentials），并在 MCP 客户端配置中设置上述两个环境变量。'
    );
  }
}

/**
 * 使用 client_credentials 获取企业令牌（access_token）
 * @see GET /v1/auth/token?grant_type=client_credentials&client_id=...&client_secret=...
 */
export async function fetchEnterpriseToken(): Promise<OpenApiToken> {
  assertCredentialsConfigured();
  const url = `${OPEN_API_BASE_URL}/auth/token`;
  const resp = await axios.get(url, {
    params: {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    },
    timeout: 15000,
  });
  const data = resp.data || {};
  if (!data.access_token) {
    throw new Error(`获取企业令牌失败：${JSON.stringify(data)}`);
  }
  const token: OpenApiToken = {
    access_token: data.access_token,
    refresh_token: undefined,
    token_type: data.token_type || 'Bearer',
    expires_in: Number(data.expires_in) || 0,
    obtained_at: Date.now(),
    client_id: CLIENT_ID,
  };
  saveToken(token);
  return token;
}

/**
 * 返回有效 access_token：优先用未过期缓存，否则重新 client_credentials
 */
export async function getValidAccessToken(): Promise<string> {
  assertCredentialsConfigured();
  const cached = loadToken();
  if (
    cached &&
    cached.access_token &&
    (!cached.client_id || cached.client_id === CLIENT_ID) &&
    !isTokenExpired(cached)
  ) {
    return cached.access_token;
  }
  const next = await fetchEnterpriseToken();
  return next.access_token;
}

/** 忽略缓存，强制重新换取企业令牌（401 恢复或轮换 secret 后使用） */
export async function forceEnterpriseTokenRefresh(): Promise<OpenApiToken> {
  clearToken();
  return fetchEnterpriseToken();
}

export function describeTokenStatus(): {
  configured: boolean;
  cached: boolean;
  expired: boolean;
  expiresAt?: string;
  clientIdMatched?: boolean;
} {
  const configured = !!(CLIENT_ID && CLIENT_SECRET);
  const t = loadToken();
  if (!t) {
    return { configured, cached: false, expired: true };
  }
  const expired = isTokenExpired(t);
  return {
    configured,
    cached: true,
    expired,
    expiresAt: new Date(t.obtained_at + t.expires_in * 1000).toLocaleString('zh-CN'),
    clientIdMatched: !CLIENT_ID || !t.client_id || CLIENT_ID === t.client_id,
  };
}

/**
 * 供 MCP op_check_auth：校验环境变量并尝试换取令牌（成功则写入缓存）
 */
export async function verifyOpenApiCredentials(): Promise<{
  ok: boolean;
  message: string;
  expiresAt?: string;
}> {
  try {
    assertCredentialsConfigured();
  } catch (e: any) {
    return { ok: false, message: e.message };
  }
  try {
    const t = await fetchEnterpriseToken();
    return {
      ok: true,
      message: '开放平台企业令牌获取成功',
      expiresAt: new Date(t.obtained_at + t.expires_in * 1000).toLocaleString('zh-CN'),
    };
  } catch (e: any) {
    return { ok: false, message: `换取企业令牌失败：${e.message}` };
  }
}
