FROM node:20.10-alpine

# Install pnpm
RUN corepack enable && corepack prepare pnpm@8.x --activate

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with proper error handling
RUN pnpm install || (echo "Package installation failed!" && exit 1)

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Start development server with host set to allow external access
CMD ["pnpm", "dev", "--host"] 
