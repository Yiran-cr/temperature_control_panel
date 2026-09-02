import { z } from 'zod';

/**
 * 环境变量运行时校验（zod）
 * 工业级原则：配置错误必须在启动即暴露，而不是运行到一半才崩。
 * 替代原来散落的裸字符串 `import.meta.env.VITE_*`。
 *
 * 模板化：本面板是可被不同用户复用的「温度显示模板」，
 * 标题、冷库名称/ID、数据源与网关凭证均可通过部署环境变量覆盖，
 * 代码内不再硬编码任何业务数据库连接。
 */
const envSchema = z.object({
  VITE_USE_MOCK: z.enum(['true', 'false']).optional().default('true'),
  /** 数据源：mock | gateway（优先级高于 VITE_USE_MOCK） */
  VITE_DATA_SOURCE: z.enum(['mock', 'gateway']).optional(),
  // ===== 网关数据源（后端网关，JWT + WebSocket）=====
  VITE_GATEWAY_BASE_URL: z.string().default('http://localhost:4000'),
  VITE_GATEWAY_USERNAME: z.string().default('admin'),
  VITE_GATEWAY_PASSWORD: z.string().default('admin'),
  // ===== 模板化显示配置（不同用户部署时按需覆盖）=====
  VITE_APP_TITLE: z.string().default('冷库温度监控系统'),
  VITE_STORAGE_ID: z.string().default('cold-storage-01'),
  VITE_STORAGE_NAME: z.string().default('冷库'),
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

/** 数据源类型：mock | gateway（浏览器不再直连数据库） */
export type DataSourceKind = 'mock' | 'gateway';

/** 当前数据源（VITE_DATA_SOURCE 优先，否则按 VITE_USE_MOCK 推导） */
export const DATA_SOURCE: DataSourceKind =
  env.VITE_DATA_SOURCE ?? (USE_MOCK ? 'mock' : 'gateway');

/** 网关数据源连接配置（JWT 登录凭证） */
export const gatewayConfig = {
  baseUrl: env.VITE_GATEWAY_BASE_URL,
  username: env.VITE_GATEWAY_USERNAME,
  password: env.VITE_GATEWAY_PASSWORD,
} as const;

/** 模板标题（页面 Header 展示，部署时通过 VITE_APP_TITLE 覆盖） */
export const APP_TITLE = env.VITE_APP_TITLE;

/** 当前展示的冷库（模板化：名称/ID 由部署环境变量配置，预留多冷库扩展） */
export const COLD_STORAGE = {
  id: env.VITE_STORAGE_ID,
  name: env.VITE_STORAGE_NAME,
} as const;

/** 默认时间窗 */
export const DEFAULT_RANGE_MS = 86400000;
