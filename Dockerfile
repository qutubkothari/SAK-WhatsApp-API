FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/database ./src/database
COPY --from=builder /app/knexfile.ts ./

COPY --from=builder /app/run-migrations.js ./

RUN mkdir -p whatsapp_sessions logs

EXPOSE 5000

CMD ["sh", "-c", "node run-migrations.js && node dist/server.js"]
