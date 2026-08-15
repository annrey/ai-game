# ---- Build Stage ----
FROM rust:1.92-alpine AS builder
WORKDIR /app
RUN apk add --no-cache musl-dev
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
RUN cargo build -p ai-storyteller --release

# ---- Production Stage ----
FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache libgcc wget
COPY --from=builder /app/target/release/ai-storyteller /usr/local/bin/ai-storyteller
COPY ui ./ui
COPY scripts ./scripts
COPY skills ./skills
COPY .env.example ./.env
RUN mkdir -p /app/data

ENV BIND_HOST=0.0.0.0
ENV ALLOW_REMOTE=true

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/api/health || exit 1

CMD ["ai-storyteller"]
