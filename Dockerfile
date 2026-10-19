# syntax=docker/dockerfile:1
# Static-only image: the app shell, the prerendered content pages and the
# kernels behind nginx. Cloud features (sharing, sign-in, community, collab)
# have no backend here and answer 503; see docs/self-hosting.md.

# glibc on purpose: it is the toolchain CI and Vercel build with, and the
# native TypeScript compiler has no musl build.
FROM --platform=$BUILDPLATFORM node:24-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20 AS build
WORKDIR /app
ENV PNPM_HOME=/pnpm COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
# corepack reads the pinned pnpm from package.json; it runs before .npmrc lands
# because that file's min-release-age would refuse a fresh exact pin under npm.
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY packages ./packages
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile --store-dir /pnpm/store
COPY . .
# No .git in the context: version.json and the OCI revision label take these.
ARG GIT_SHA=""
ARG GIT_COMMIT_TIME=""
ARG VERSION="dev"
ARG VITE_SELF_HOSTED=1
ENV GIT_SHA=$GIT_SHA GIT_COMMIT_TIME=$GIT_COMMIT_TIME VITE_SELF_HOSTED=$VITE_SELF_HOSTED
# Hidden source maps are emitted for error-tracking upload; nothing serves them.
RUN pnpm run build && find dist -name '*.map' -delete

# COPY-only stage: nothing executes here, so the arm64 image builds without
# emulation. The dist is arch-independent.
FROM nginxinc/nginx-unprivileged:1.31.6-alpine-slim@sha256:ac4d9c7e457c6510b95ac72dd84b27f7cc68ecb9a83fbd44f05a6460cf08aba4
ARG GIT_SHA=""
ARG VERSION="dev"
LABEL org.opencontainers.image.source="https://github.com/andymai/gridfinity-layout-tool" \
      org.opencontainers.image.url="https://gridfinitylayouttool.com" \
      org.opencontainers.image.description="Plan Gridfinity drawer layouts and design bins and baseplates for 3D printing" \
      org.opencontainers.image.licenses="AGPL-3.0-only" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.revision="$GIT_SHA"
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/self-hosted /usr/share/nginx/self-hosted
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:8080/version.json || exit 1
