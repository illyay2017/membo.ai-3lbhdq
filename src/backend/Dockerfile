# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files for dependency installation
COPY package*.json ./

# Install build dependencies and production dependencies
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npm cache clean --force

# Copy source code and configuration files
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript code to JavaScript
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# Development stage
FROM node:20-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm install -g tsx ts-node typescript nodemon
RUN npm install
COPY . .
ENV NODE_ENV=development
ENV TS_NODE_PROJECT=./tsconfig.json
ENV TS_NODE_FILES=true
ENV PATH="/app/node_modules/.bin:${PATH}"
EXPOSE 4000 9229
RUN apk add --no-cache curl
CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-alpine AS production
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
