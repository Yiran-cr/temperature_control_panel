import 'dotenv/config';
import { z } from 'zod';

/**
 * 网关环境变量运行时校验（zod）
 * - 服务端持有 TDengine 凭据，浏览器不可见
 * - 启动即失败（fail fast），避免带病运行
 */
const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // JWT
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET 至少 16 字符，生产环境必须为强随机值'),
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD: z.string().min(1),
  TOKEN_TTL_SEC: z.coerce.number().int().positive().default(43200),

  // TDengine
  TDENGINE_BASE_URL: z.url(),
  TDENGINE_AUTH: z.string().min(1),
  TDENGINE_DATABASE: z.string().min(1),
  TDENGINE_STABLE: z.string().min(1),
  TDENGINE_TEMP_FIELD: z.string().min(1),
  TDENGINE_TS_FIELD: z.string().default('ts'),

  // 轮询
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),

  // ===== 模板化显示配置（不同用户部署时按需覆盖）=====
  STORAGE_ID: z.string().min(1).default('cold-storage-01'),
  STORAGE_NAME: z.string().min(1).default('冷库'),
});

export type GatewayConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GatewayConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`网关环境变量校验失败：${issues}`);
  }
  return parsed.data;
}
