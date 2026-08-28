import { z } from 'zod';
import type { DataSourceConfig } from '../infrastructure/ports';

/**
 * 环境变量运行时校验（zod）
 * 工业级原则：配置错误必须在启动即暴露，而不是运行到一半才崩。
 * 替代原来散落的裸字符串 `import.meta.env.VITE_*`。
 */
const envSchema = z.object({
  VITE_USE_MOCK: z.enum(['true', 'false']).optional().default('true'),
  /** 数据源：mock | tdengine | gateway（优先级高于 VITE_USE_MOCK） */
  VITE_DATA_SOURCE: z.enum(['mock', 'tdengine', 'gateway']).optional(),
  VITE_TDENGINE_BASE_URL: z.string().default('/api/tdengine'),
  VITE_TDENGINE_AUTH: z.string().default('Basic cm9vdDp0YW9zZGF0YQ=='),
  VITE_TDENGINE_DATABASE: z.string().default('scada'),
  VITE_TDENGINE_STABLE: z.string().default('equ_refrigerator'),
  VITE_TDENGINE_TEMP_FIELD: z.string().optional(),
  VITE_TDENGINE_TS_FIELD: z.string().default('ts'),
  VITE_TDENGINE_POLL_INTERVAL: z.coerce.number().int().positive().default(1000),
  // ===== 网关数据源（后端网关，JWT + WebSocket）=====
  VITE_GATEWAY_BASE_URL: z.string().default('http://localhost:4000'),
  VITE_GATEWAY_USERNAME: z.string().default('admin'),
  VITE_GATEWAY_PASSWORD: z.string().default('admin'),
});

const parsed = envSchema.safeParse(import.meta.env);
if (!parsed.success) {
  const detail = parsed.error.issues
    .map((i) => `${i.path.join('.')} ${i.message}`)
    .join('; ');
  throw new Error(`环境变量校验失败: ${detail}`);
}
export const env = parsed.data;

/** 是否使用 Mock 数据源（兼容旧配置；新配置请用 DATA_SOURCE） */
export const USE_MOCK = env.VITE_USE_MOCK !== 'false';

/** 数据源类型：mock | tdengine | gateway */
export type DataSourceKind = 'mock' | 'tdengine' | 'gateway';

/** 当前数据源（VITE_DATA_SOURCE 优先，否则按 VITE_USE_MOCK 推导） */
export const DATA_SOURCE: DataSourceKind =
  env.VITE_DATA_SOURCE ?? (USE_MOCK ? 'mock' : 'tdengine');

/** 传给数据源 connect() 的连接配置（语义化命名） */
export const dataSourceConfig: DataSourceConfig = {
  url: env.VITE_TDENGINE_BASE_URL,
  token: env.VITE_TDENGINE_AUTH,
  database: env.VITE_TDENGINE_DATABASE,
  stable: env.VITE_TDENGINE_STABLE,
  tempField: env.VITE_TDENGINE_TEMP_FIELD,
  tsField: env.VITE_TDENGINE_TS_FIELD,
  pollIntervalMs: env.VITE_TDENGINE_POLL_INTERVAL,
};

/** 网关数据源连接配置（JWT 登录凭证） */
export const gatewayConfig = {
  baseUrl: env.VITE_GATEWAY_BASE_URL,
  username: env.VITE_GATEWAY_USERNAME,
  password: env.VITE_GATEWAY_PASSWORD,
} as const;

/** 当前单冷库（预留扩展：日后改数组即可，UI 层无需改动） */
export const COLD_STORAGE = { id: 'cold-storage-01', name: '冷库' } as const;

/** 实时缓冲上限与默认时间窗 */
export const BUFFER_MAX_SIZE = 2000;
export const DEFAULT_RANGE_MS = 86400000;
