# Build stage
FROM node:20.10-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install build dependencies and production dependencies
RUN apk add --no-cache python3 make g++ \
    && npm ci --platform=linux --arch=arm64 \
    && npm cache clean --force

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code to JavaScript
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Development stage
FROM node:20.10-alpine AS development
WORKDIR /app

# Copy package files and install ALL dependencies (including dev dependencies)
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

ENV NODE_ENV=development
ENV DEBUG=*

CMD ["npm", "run", "dev"]

# Add this to ensure proper cleanup
STOPSIGNAL SIGTERM

# Production stage
FROM node:20.10-alpine AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
ENV NODE_OPTIONS="--experimental-specifier-resolution=node"
EXPOSE 4000
USER node
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1
CMD ["node", "dist/server.js"]
