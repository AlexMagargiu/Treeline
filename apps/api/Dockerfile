# Build context is the repository root, so the workspace manifests and the lockfile
# are visible to pnpm.
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @treeline/api...

FROM deps AS build
COPY apps/api apps/api
COPY prisma prisma
RUN pnpm --filter @treeline/api build
RUN pnpm install --frozen-lockfile --prod --filter @treeline/api...

FROM node:22-alpine AS runtime
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/prisma prisma
WORKDIR /app/apps/api
USER node
EXPOSE 3001
CMD ["node", "dist/main.js"]
