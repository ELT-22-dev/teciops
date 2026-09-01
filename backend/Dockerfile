# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Production stage ---
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --omit=dev && npx prisma generate

COPY --from=build /app/dist ./dist

EXPOSE 4000

CMD ["node", "dist/server.js"]
