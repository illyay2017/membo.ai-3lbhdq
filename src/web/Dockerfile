FROM node:20-slim AS development

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*

# Copy only package files first
COPY package*.json ./

# Install dependencies with legacy peer deps
RUN npm install --legacy-peer-deps \
    && npm cache clean --force

# Copy source code (excluding node_modules via .dockerignore)
COPY . .

# Expose Vite's default port
EXPOSE 3000

# Default command
CMD ["npm", "run", "dev"]
