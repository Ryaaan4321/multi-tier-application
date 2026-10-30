FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.base.json ./
COPY proxy/package.json ./proxy/
COPY service/package.json ./service/

RUN npm install

COPY proxy ./proxy
RUN cd proxy && npm run build

FROM node:20-alpine AS runner

WORKDIR /app/proxy

COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/proxy/node_modules /app/proxy/node_modules
COPY --from=builder /app/proxy/dist ./dist
COPY --from=builder /app/proxy/package.json ./package.json

EXPOSE 4000

CMD ["node", "dist/server.js"]