FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY service/package.json ./service/
COPY proxy/package.json ./proxy/

RUN npm install

COPY service/prisma ./service/prisma
RUN cd service && npx prisma generate

COPY service ./service
RUN cd service && npm run build

FROM node:20-slim AS runner

WORKDIR /app/service

RUN apt-get update -y && apt-get install -y openssl

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/service/dist ./dist
COPY --from=builder /app/service/package.json ./package.json
COPY --from=builder /app/service/prisma ./prisma

EXPOSE 4000-4006

CMD ["node", "dist/server.js"]
