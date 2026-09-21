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
CMD ["pnpm", "--filter", "@mentoring/web", "dev", "--", "-H", "0.0.0.0"]

FROM dependencies AS build
COPY . .
RUN pnpm --filter @mentoring/web build

FROM build AS production
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
CMD ["pnpm", "--filter", "@mentoring/web", "start", "--", "-H", "0.0.0.0", "-p", "3001"]
