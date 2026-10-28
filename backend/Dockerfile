# Money Management API (NestJS) — three stages: production dependencies, compile, run.
#
# Reproducible: the base image is pinned to an exact Node + Alpine version, dependencies come only from
# package-lock.json (`npm ci`), and nothing is fetched at run time. Immutable: the runtime image holds compiled
# JavaScript and production node_modules only, owned by root and read-only to the `node` user it runs as. All
# configuration is environment variables — see .env.example.
#
# Why Node 24 (the LTS line) and not 22: the lockfiles are written by npm 11/12, and the npm 10 that ships with Node 22
# refuses backend/package-lock.json ("Missing: webpack from lock file"). Node 24's npm 11 accepts it. The engines
# floors (>= 22.12 backend, >= 22.22 frontend) allow it. Keep CI's NODE_VERSION (.github/workflows/ci.yml) in step.
#
# Build context is this directory:   docker build -t money-management-backend backend/

ARG NODE_IMAGE=node:24.22.1-alpine3.24

# ---- deps: production node_modules only; the dev toolchain never reaches the runtime image ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- build: compile TypeScript with the full toolchain ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 3000

# Healthy = the API answers an anonymous GET /api/v1/me with 401: the process is up, Nest routes the request and the
# global session guard is active. (Liveness, not a database check — the smoke test covers Postgres.) Node's own
# fetch is used because Alpine's wget treats a 401 as a failure.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/v1/me').then((r) => process.exit(r.status === 401 ? 0 : 1), () => process.exit(1))"]

CMD ["node", "dist/main.js"]
