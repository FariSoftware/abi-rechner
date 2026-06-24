# Build from the REPOSITORY ROOT so abi-core.js (one level above mcp/) is in
# the build context:  docker build -f mcp/Dockerfile -t abi-rechner-mcp .
#
# Multi-stage: install prod deps on alpine, run on distroless (non-root).

# ── deps ──────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app/mcp
COPY mcp/package.json mcp/package-lock.json ./
RUN npm ci --omit=dev

# ── runtime ───────────────────────────────────────────────────
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=deps /app/mcp/node_modules ./mcp/node_modules
COPY mcp/package.json ./mcp/package.json
COPY mcp/src ./mcp/src
COPY abi-core.js ./abi-core.js

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# distroless nodejs image's entrypoint is `node`.
CMD ["mcp/src/server.js", "--http"]
