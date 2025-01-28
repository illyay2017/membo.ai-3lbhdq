FROM node:20.10-alpine

ENV NODE_ENV=development
ENV PATH /app/node_modules/.bin:$PATH

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.x --activate

WORKDIR /app

# Install development tools
RUN apk add --no-cache git

# Copy package files
COPY package.json ./

# Install dependencies with proper error handling
RUN pnpm install --no-frozen-lockfile --shamefully-hoist

# Ensure node_modules/@fontsource exists
RUN mkdir -p node_modules/@fontsource

# Copy source code
COPY . .

# Verify font files exist
RUN ls -la node_modules/@fontsource/inter
RUN ls -la node_modules/@fontsource/jetbrains-mono

# Expose Vite dev server port
EXPOSE 5173

# Start development server with host set to allow external access
CMD ["pnpm", "dev", "--host", "0.0.0.0", "--port", "5173"] 
