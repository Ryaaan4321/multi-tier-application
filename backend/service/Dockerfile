FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY service/package.json ./service/
COPY proxy/package.json ./proxy/

RUN npm install

COPY service/prisma ./service/prisma
RUN cd service && npx prisma generate

COPY service ./service
RUN cd service && npm run build

FROM node:20-alpine AS runner

WORKDIR /app/service

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/service/node_modules /app/service/node_modules
COPY --from=builder /app/service/dist ./dist
COPY --from=builder /app/service/package.json ./package.json
COPY --from=builder /app/service/prisma ./prisma

EXPOSE 4000-4006

CMD ["node", "dist/server.js"]