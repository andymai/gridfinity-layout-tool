# syntax=docker/dockerfile:1.7

FROM node:24-bookworm-slim AS build

WORKDIR /app

ENV HUSKY=0

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/branded-types/package.json packages/branded-types/package.json
COPY patches patches

RUN pnpm install --frozen-lockfile

COPY . .

ARG VITE_LIVEBLOCKS_PUBLIC_KEY
ARG VITE_PUBLIC_POSTHOG_KEY

ENV VITE_LIVEBLOCKS_PUBLIC_KEY=$VITE_LIVEBLOCKS_PUBLIC_KEY
ENV VITE_PUBLIC_POSTHOG_KEY=$VITE_PUBLIC_POSTHOG_KEY

RUN pnpm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
