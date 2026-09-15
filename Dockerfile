# Multi-stage Dockerfile for Express.js REST API
# Stage 1: Dependencies & Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

# Create invoices directory for PDFKit
RUN mkdir -p storage/invoices && chown -R node:node storage

USER node
EXPOSE 4000

CMD ["node", "dist/index.js"]
