import jwt from 'jsonwebtoken';
import type { IncomingMessage } from 'node:http';

export interface AuthServiceOptions {
  secret: string;
  username: string;
  password: string;
  tokenTtlSec: number;
}

export interface AuthPayload {
  sub?: string;
  type?: 'api' | 'ws';
  iat: number;
  exp: number;
}

/** WS 升级票据有效期（秒）——比长期 JWT 更短，降低 URL 泄露风险 */
const WS_TICKET_TTL_SEC = 30;

export class AuthService {
  private readonly opts: AuthServiceOptions;

  constructor(opts: AuthServiceOptions) {
    this.opts = opts;
  }

  /** 登录成功返回 JWT，失败返回 null */
  login(username: string, password: string): string | null {
    if (username !== this.opts.username || password !== this.opts.password) {
      return null;
    }
    return this.sign({ type: 'api' }, this.opts.tokenTtlSec);
  }

  /** 签发短时 WS 升级票据（一次性、短效） */
  issueWsTicket(): string {
    return this.sign({ type: 'ws' }, WS_TICKET_TTL_SEC);
  }

  /** 校验普通 API token */
  verifyApiToken(token: string | undefined): boolean {
    const payload = this.verify(token);
    return payload !== null && payload.type === 'api';
  }

  /** 校验 WS 升级票据 */
  verifyWsTicket(token: string | undefined): boolean {
    const payload = this.verify(token);
    return payload !== null && payload.type === 'ws';
  }

  private sign(claims: Partial<AuthPayload>, expiresIn: number): string {
    return jwt.sign(claims, this.opts.secret, {
      subject: this.opts.username,
      expiresIn,
    });
  }

  private verify(token: string | undefined): AuthPayload | null {
    if (!token) return null;
    try {
      return jwt.verify(token, this.opts.secret) as AuthPayload;
    } catch {
      return null;
    }
  }
}

/** 从 Authorization 头提取 Bearer token */
export function extractBearerToken(req: IncomingMessage): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
}
