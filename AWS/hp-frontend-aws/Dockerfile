# ========== deps: 의존성 설치 ==========
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN corepack enable pnpm 2>/dev/null || true && \
  if [ -f pnpm-lock.yaml ]; then pnpm i --frozen-lockfile; \
  elif [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  else npm ci; fi

# ========== build: Next 빌드 ==========
# NEXT_PUBLIC_* 는 빌드 시점에 번들에 박히므로 반드시 build-arg 로 넘겨야 함.
# 예: docker build --build-arg NEXT_PUBLIC_API_BASE_URL=https://homeplate.site/api ... -t ghcr.io/skyoo456/hp-frontend:latest .
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_RUM_ENABLED
ARG NEXT_PUBLIC_RUM_ENDPOINT
ARG NEXT_PUBLIC_RUM_APP_NAME
ARG NEXT_PUBLIC_RUM_ENV
ARG NEXT_PUBLIC_RUM_CLUSTER
ARG NEXT_PUBLIC_RUM_SAMPLE_RATE

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_RUM_ENABLED=$NEXT_PUBLIC_RUM_ENABLED
ENV NEXT_PUBLIC_RUM_ENDPOINT=$NEXT_PUBLIC_RUM_ENDPOINT
ENV NEXT_PUBLIC_RUM_APP_NAME=$NEXT_PUBLIC_RUM_APP_NAME
ENV NEXT_PUBLIC_RUM_ENV=$NEXT_PUBLIC_RUM_ENV
ENV NEXT_PUBLIC_RUM_CLUSTER=$NEXT_PUBLIC_RUM_CLUSTER
ENV NEXT_PUBLIC_RUM_SAMPLE_RATE=$NEXT_PUBLIC_RUM_SAMPLE_RATE

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ========== runtime: standalone 서버 실행 ==========
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && \
  adduser --system --uid 1001 nextjs
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "server.js"]
