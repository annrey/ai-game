# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# 安装构建依赖（better-sqlite3 需要编译）
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

# better-sqlite3 运行时需要的原生模块
RUN apk add --no-cache libstdc++

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/ui ./ui
COPY --from=builder /app/skills ./skills
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 创建数据目录
RUN mkdir -p /app/data

# 如果存在 .env.example 则复制为 .env
COPY --from=builder /app/.env.example ./.env 2>/dev/null || true

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
