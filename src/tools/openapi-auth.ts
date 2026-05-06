import {
  clearToken,
  describeTokenStatus,
  getTokenFilePath,
  verifyOpenApiCredentials,
} from '../utils/openapi-token.js';

export function opLogout(): { success: boolean; message: string } {
  clearToken();
  return { success: true, message: '已清除本地缓存的开放平台企业令牌（openapi.json）' };
}

export async function opCheckAuth(): Promise<{
  authenticated: boolean;
  message: string;
  expiresAt?: string;
}> {
  const st = describeTokenStatus();
  if (!st.configured) {
    return {
      authenticated: false,
      message: '未配置 PINGCODE_CLIENT_ID / PINGCODE_CLIENT_SECRET',
    };
  }
  if (st.cached && !st.expired && st.clientIdMatched !== false) {
    return {
      authenticated: true,
      message: `已缓存有效企业令牌（${getTokenFilePath()}）`,
      expiresAt: st.expiresAt,
    };
  }
  const v = await verifyOpenApiCredentials();
  return {
    authenticated: v.ok,
    message: v.message,
    expiresAt: v.expiresAt,
  };
}
