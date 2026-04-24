FROM node:20-alpine AS deps

WORKDIR /app

COPY client/package*.json ./client/
COPY server/package*.json ./server/

RUN npm install --prefix client && npm install --omit=dev --prefix server

FROM node:20-alpine AS build

WORKDIR /app

COPY --from=deps /app/client/node_modules ./client/node_modules
COPY --from=deps /app/server/node_modules ./server/node_modules

COPY client ./client
COPY server ./server

RUN npm run build --prefix client

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=build /app/server ./server

RUN mkdir -p /app/uploads

WORKDIR /app/server

EXPOSE 3000

CMD ["node", "index.js"]
