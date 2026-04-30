# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# 安装构建依赖（better-sqlite3 需要编译）和 pnpm
RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm

# 复制 workspace 配置和依赖文件
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/ui/package.json apps/ui/
COPY packages/core/package.json packages/core/
COPY packages/memory/package.json packages/memory/
COPY packages/plugin-sdk/package.json packages/plugin-sdk/
COPY packages/plugins/provider-local/package.json packages/plugins/provider-local/
COPY tsconfig.json ./

RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# ---- Production Stage ----
FROM node:20-alpine
WORKDIR /app

# better-sqlite3 运行时需要的原生模块 + curl 用于健康检查
RUN apk add --no-cache libstdc++ curl

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

# 健康检查 - 使用 curl 替代 wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
