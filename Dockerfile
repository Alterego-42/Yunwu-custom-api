FROM node:22-bookworm AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS api-build
COPY . .
RUN pnpm --filter @yunwu/api build

FROM deps AS web-build
ARG VITE_API_BASE_URL=/
ARG VITE_CONVERSATION_SSE_PATH_TEMPLATE=/conversations/:id/events
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_CONVERSATION_SSE_PATH_TEMPLATE=${VITE_CONVERSATION_SSE_PATH_TEMPLATE}
COPY . .
RUN pnpm --filter @yunwu/shared build && pnpm --filter @yunwu/web exec vite build

FROM base AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=api-build /app/apps/api/package.json ./apps/api/package.json
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-build /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=api-build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=api-build /app/packages/shared/dist ./packages/shared/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

FROM api AS worker
CMD ["node", "apps/api/dist/worker.js"]

FROM nginx:1.27-alpine AS web
COPY infra/nginx/web.conf /etc/nginx/conf.d/default.conf
COPY --from=web-build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
