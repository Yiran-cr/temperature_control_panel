# ===== 温度监控前端镜像（多阶段构建）=====

# ---- 阶段 1：构建静态资源 ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# 生产环境网关走同源反代（nginx → gateway），覆盖 .env 中的本地开发地址
ARG VITE_GATEWAY_BASE_URL=""
ENV VITE_GATEWAY_BASE_URL=$VITE_GATEWAY_BASE_URL
RUN npm run build

# ---- 阶段 2：Nginx 运行 ----
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
