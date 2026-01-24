# Sentinel Authority Frontend Dockerfile

# Build stage
FROM node:20-alpine as build

WORKDIR /app

# Set build-time env variable
ARG VITE_API_URL=https://sentinel-authority-production.up.railway.app
ENV VITE_API_URL=$VITE_API_URL

# Copy all files
COPY . .

# Install dependencies
RUN npm install

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration  
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
