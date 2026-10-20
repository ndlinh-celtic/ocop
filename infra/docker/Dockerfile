# One build, three targets: web (Next standalone), worker and migrate (run TypeScript with tsx).
FROM node:22-alpine AS base
ENV COREPACK_HOME=/usr/local/share/corepack
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate && chmod -R a+rX $COREPACK_HOME
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/core/package.json packages/core/
COPY packages/infra/package.json packages/infra/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile

FROM deps AS source
COPY . .

FROM source AS web-build
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @ocop/web build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=web-build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=web-build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]

FROM source AS worker
ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@ocop/worker", "exec", "tsx", "src/main.ts"]

FROM source AS migrate
USER node
CMD ["pnpm", "--filter", "@ocop/infra", "migrate"]
