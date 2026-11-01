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

WORKDIR /app

COPY --from=builder /app /app

WORKDIR /app/proxy

EXPOSE 4000

CMD ["node", "dist/server.js"]
