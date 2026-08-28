import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { GatewayConfig } from '../config';
import type { TdengineClient } from '../core/tdengine';
import { AuthService, extractBearerToken } from './auth';

export interface HttpDeps {
  auth: AuthService;
  tdengine: TdengineClient;
  config: GatewayConfig;
}

const HISTORY_WINDOW_MIN = 30;

export function createHttpServer(deps: HttpDeps): Server {
  return createServer((req, res) => {
    // 允许 Vite 开发服务器跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    dispatch(req, res, deps).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : '内部错误';
      sendJson(res, 500, { error: message });
    });
  });
}

async function dispatch(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpDeps,
): Promise<void> {
  const { pathname, searchParams } = new URL(req.url ?? '/', 'http://localhost');
  const method = req.method ?? 'GET';

  if (method === 'POST' && pathname === '/api/login') {
    await handleLogin(req, res, deps);
    return;
  }

  // 公开健康检查（供容器编排 / 负载均衡探测，无需鉴权）
  if (method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { status: 'ok', time: Date.now(), uptime: process.uptime() });
    return;
  }

  // 以下路由均需鉴权
  const token = extractBearerToken(req);
  if (!deps.auth.verifyApiToken(token)) {
    sendJson(res, 401, { error: '未授权或令牌已过期' });
    return;
  }

  if (method === 'GET' && pathname === '/api/ws-ticket') {
    sendJson(res, 200, { ticket: deps.auth.issueWsTicket() });
    return;
  }
  if (method === 'GET' && pathname === '/api/config') {
    sendJson(res, 200, {
      source: 'gateway',
      storageId: 'cold-storage-01',
      alert: { high: deps.config.ALERT_HIGH, low: deps.config.ALERT_LOW },
      pollIntervalMs: deps.config.POLL_INTERVAL_MS,
    });
    return;
  }
  if (method === 'GET' && pathname === '/api/history') {
    const raw = searchParams.get('minutes');
    const minutes = Number(raw ?? undefined);
    const windowMs = Number.isFinite(minutes) && minutes > 0
      ? Math.min(minutes, 24 * 60) * 60_000
      : HISTORY_WINDOW_MIN * 60_000;
    const points = await deps.tdengine.queryRecent(windowMs);
    sendJson(res, 200, { points });
    return;
  }

  sendJson(res, 404, { error: `Not Found: ${method} ${pathname}` });
}

async function handleLogin(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HttpDeps,
): Promise<void> {
  const body = await readJson<{ username?: string; password?: string }>(req);
  const token = deps.auth.login(body.username ?? '', body.password ?? '');
  if (!token) {
    sendJson(res, 401, { error: '用户名或密码错误' });
    return;
  }
  sendJson(res, 200, { token, expiresIn: deps.config.TOKEN_TTL_SEC });
}

function readJson<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('请求体过大'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? (JSON.parse(raw) as T) : ({} as T));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}
