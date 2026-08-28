# ===== 温度监控网关镜像 =====
# 轻量运行：node:22-alpine + tsx 直接运行 TS 源码
FROM node:22-alpine

WORKDIR /app

# 先安装依赖（利用 Docker 层缓存，仅源码变更时无需重装）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 拷贝源码（.env 不进入镜像，由 compose env_file 注入）
COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# 容器健康检查（公开端点 /api/health）
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health > /dev/null || exit 1

CMD ["npm", "run", "start"]
