# Money Management Web App edge — builds the React SPA, then serves it with nginx, which also reverse-proxies /api/ to
# the backend so the browser sees ONE origin (the backend has no CORS and the httpOnly `sid` cookie must stay
# same-origin).
#
# Reproducible: both base images are pinned to exact versions, dependencies come only from package-lock.json
# (`npm ci`). Immutable: the runtime image is nginx-unprivileged (uid 101, no root, port 8080) plus static files; the
# only thing rendered at start-up is the nginx config, from the two environment variables below.
#
# Node 24 (LTS) for the build, matching backend/Dockerfile (see the note there on npm 10 vs the lockfiles). jsdom, used
# only by the unit tests, needs Node >= 24.15 on the 24 line.
#
# Build context is this directory:   docker build -t money-management-web frontend/

ARG NODE_IMAGE=node:24.22.1-alpine3.24
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine

# ---- build: type-check and bundle ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM ${NGINX_IMAGE} AS runtime

# nginx's entrypoint renders /etc/nginx/templates/*.template with envsubst into /etc/nginx/conf.d at start-up.
#   BACKEND_ORIGIN       where /api/ is proxied (the compose service `backend`)
#   TRUSTED_PROXY_CIDR   the load balancer in front of this container; 127.0.0.1/32 = trust nobody
# NGINX_ENTRYPOINT_LOCAL_RESOLVERS makes the entrypoint export NGINX_LOCAL_RESOLVERS (the nameservers of
# /etc/resolv.conf), so nginx re-resolves the backend at request time and survives the backend container being
# recreated with a new address.
ENV BACKEND_ORIGIN=http://backend:3000 \
    TRUSTED_PROXY_CIDR=127.0.0.1/32 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

# nginx answers /healthz itself, without touching the SPA files or the backend.
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
