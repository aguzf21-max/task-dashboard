FROM node:22-alpine AS base
WORKDIR /workspace
RUN corepack enable

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

FROM dependencies AS development
COPY . .
CMD ["pnpm", "--filter", "@mentoring/api", "start:dev"]

FROM dependencies AS build
COPY . .
RUN pnpm --filter @mentoring/api build

FROM build AS production
ENV NODE_ENV=production
CMD ["node", "apps/api/dist/main.js"]
