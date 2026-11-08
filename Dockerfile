FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
COPY packages ./packages
RUN npm ci

COPY . .
RUN npm run build

FROM node:24-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY --from=build /app/packages ./packages
RUN npm ci --omit=dev

COPY server ./server
COPY --from=build /app/dist ./dist

EXPOSE 8001

CMD ["node", "server"]
