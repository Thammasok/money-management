---
name: nginx-edge-and-compose-gotchas
description: Non-obvious behaviours hit while building the nginx-unprivileged edge and the production compose stack (envsubst, add_header inheritance, runtime DNS, read-only rootfs, rate-limit key map, Referrer-Policy)
metadata:
  type: project
---

- **Template rendering**: `nginxinc/nginx-unprivileged` renders `/etc/nginx/templates/*.template` with envsubst into `/etc/nginx/conf.d/` at start-up; http-level directives (`map`, `limit_req_zone`, `log_format`) may sit at the top of the template because `conf.d/*.conf` is included inside `http {}`. Only `$NAME` of variables defined in the environment are substituted; lowercase nginx variables pass through. Avoid `${VAR}` text in comments (it is substituted too).
- **Read-only rootfs** needs `tmpfs: /tmp` (pid file and temp paths live there) and `tmpfs: /etc/nginx/conf.d:uid=101,gid=101` (the rendered config is written there). Logging to `/dev/stdout` works as uid 101.
- **Runtime DNS**: `set $backend ${BACKEND_ORIGIN}; proxy_pass $backend;` plus `resolver ${NGINX_LOCAL_RESOLVERS} valid=10s;` (the entrypoint fills `NGINX_LOCAL_RESOLVERS` when `NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1`; Docker's resolver is 127.0.0.11). nginx then starts even if the backend does not resolve and survives the backend container being recreated; a literal `proxy_pass http://backend:3000` resolves once at start-up. A variable `proxy_pass` with no URI part forwards the original request URI unchanged.
- **`add_header` inheritance**: a block that declares any `add_header` drops all inherited ones, so shared security headers live in one snippet (`/etc/nginx/snippets/security-headers.conf`) included in each static location, and `/api/` declares none (otherwise the backend's headers would be duplicated). `expires` does not count as `add_header`.
- **Selective rate limit**: `limit_req_zone` keyed by a `map "$request_method $uri" $key` that yields `$binary_remote_addr` only for the guarded routes and `""` otherwise; nginx never counts an empty key. nginx locations are case-sensitive, so `/API/…` never reaches the backend (405 from the static location). `error_page 429 = @named` applies only to nginx's own 429, not to a proxied one, so the backend's 429 with `retryAt` passes through untouched.
- **Referrer-Policy**: with `no-referrer` browsers send `Origin: null` on same-origin POSTs; use `strict-origin-when-cross-origin` for the HTML responses.
- **Client address** behind Docker Desktop is the gateway (`172.x.0.1`) and behind any TLS proxy it is the proxy: `set_real_ip_from ${TRUSTED_PROXY_CIDR}; real_ip_header X-Forwarded-For; real_ip_recursive on;` with a default that trusts nobody (`127.0.0.1/32`).
- **Compose**: give the production stack its own project `name:` (it differs from the dev/test file's `money-management`) so volumes and `down -v` never cross; `${VAR:?message}` makes a missing secret fail fast; `up` re-runs exited one-shot services; inline `# config` / `# secret` comments in `.env.example` parse fine in Compose v2 when a space precedes the `#`.
- Nest's logger honours `NO_COLOR=1` (no ANSI codes in container logs).
