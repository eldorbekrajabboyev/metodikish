FROM node:20-slim AS builder

WORKDIR /app

COPY server/package*.json ./server/
RUN cd server && npm ci --production

COPY client/package*.json ./client/
RUN cd client && npm ci

COPY admin/package*.json ./admin/
RUN cd admin && npm ci

COPY . .

RUN cd client && npm run build
RUN cd admin && npm run build

FROM node:20-slim

ENV NODE_ENV=production

WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser appuser

COPY --from=builder --chown=appuser:appuser /app/server ./server
COPY --from=builder --chown=appuser:appuser /app/client/dist ./client/dist
COPY --from=builder --chown=appuser:appuser /app/admin/dist ./admin/dist

RUN mkdir -p /app/uploads && chown appuser:appuser /app/uploads

USER appuser

WORKDIR /app/server

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })"

CMD ["node", "index.js"]
