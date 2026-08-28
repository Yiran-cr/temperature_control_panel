import { loadConfig } from './config';
import { TdengineClient } from './core/tdengine';
import { AuthService } from './http/auth';
import { createHttpServer } from './http/server';
import { startRealtime } from './ws/realtime';

async function bootstrap(): Promise<void> {
  const config = loadConfig();

  const auth = new AuthService({
    secret: config.AUTH_SECRET,
    username: config.AUTH_USERNAME,
    password: config.AUTH_PASSWORD,
    tokenTtlSec: config.TOKEN_TTL_SEC,
  });

  const tdengine = new TdengineClient({
    baseUrl: config.TDENGINE_BASE_URL,
    auth: config.TDENGINE_AUTH,
    database: config.TDENGINE_DATABASE,
    stable: config.TDENGINE_STABLE,
    tempField: config.TDENGINE_TEMP_FIELD,
    tsField: config.TDENGINE_TS_FIELD,
  });

  const server = createHttpServer({ auth, tdengine, config });

  // HTTP 升级到 /ws 时触发（需 ws 票据）
  const realtime = startRealtime({ server, tdengine, config, auth });

  server.listen(config.PORT, () => {
    console.log(`[gateway] 监听 http://localhost:${config.PORT}`);
    console.log(`[gateway] 数据源 TDengine: ${config.TDENGINE_BASE_URL}/${config.TDENGINE_DATABASE}.${config.TDENGINE_STABLE}`);
  });

  const shutdown = (signal: string) => {
    console.log(`\n[gateway] 收到 ${signal}，正在关闭...`);
    realtime.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err: unknown) => {
  console.error('[gateway] 启动失败:', err instanceof Error ? err.message : err);
  process.exit(1);
});
