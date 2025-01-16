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

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs \
    && adduser -S nodejs -G nodejs -u 1001

# Install runtime dependencies
RUN apk add --no-cache curl

# Copy built artifacts from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./

# Create and set permissions for temp directory
RUN mkdir -p /app/tmp \
    && chown -R nodejs:nodejs /app/tmp

# Set environment variables
ENV NODE_ENV=production
ENV PORT=4000

# Expose API port
EXPOSE 4000

# Configure health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:4000/health || exit 1

# Set user
USER nodejs

# Set entry point
CMD ["node", "dist/server.js"]