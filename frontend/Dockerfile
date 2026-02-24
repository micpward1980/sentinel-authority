# ── Build stage ──
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# ── Runtime stage ──
FROM node:20-alpine AS runtime
RUN addgroup -S app && adduser -S app -G app
RUN npm install -g serve@14
WORKDIR /app
COPY --from=build /app/dist ./dist
USER app
EXPOSE 8080
CMD ["serve", "dist", "-l", "8080", "-s"]
