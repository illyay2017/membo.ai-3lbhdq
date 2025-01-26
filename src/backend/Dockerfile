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

# Copy package files
COPY package*.json ./

# Install dependencies with proper caching
RUN npm install -g tsx@4.6.2 typescript@5.3.3 nodemon@3.0.2 && \
    npm cache clean --force && \
    npm install --legacy-peer-deps && \
    npm install reflect-metadata@0.1.13 --save-exact && \
    npm ls reflect-metadata

# Copy source code after installing dependencies
COPY . .

# Verify the installation
RUN ls -la node_modules/reflect-metadata && \
    node -e "require('reflect-metadata')"

ENV NODE_ENV=development
ENV DEBUG=*

CMD ["npm", "run", "dev"]

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
