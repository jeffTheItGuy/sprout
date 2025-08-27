# Build stage
FROM node:20 AS builder

WORKDIR /app

# Copy package files
COPY ./frontend/package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY ./frontend .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY .docker/prod/nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]