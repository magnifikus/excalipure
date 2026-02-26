FROM node:25-alpine AS builder

# Build frontend
WORKDIR /opt/excalidraw
COPY package.json yarn.lock tsconfig.json .eslintignore .eslintrc.json .env.production .lintstagedrc.js vercel.json vitest.config.mts ./
COPY packages ./packages
COPY scripts ./scripts
COPY public ./public
COPY excalidraw-app ./excalidraw-app
RUN yarn install --frozen-lockfile
RUN yarn build:app:docker

# Final stage - all-in-one container
FROM node:25-alpine

# Install nginx for web serving
RUN apk add --no-cache nginx

# Create directories
RUN mkdir -p /app/data /app/files /etc/nginx/conf.d /app/backend /app/backend_colab

# Copy frontend build
COPY --from=builder /opt/excalidraw/excalidraw-app/build /usr/share/nginx/html

# Copy nginx config
COPY excalidraw-app/nginx.conf /etc/nginx/nginx.conf

# Copy backends (source only, will run with ts-node)
COPY backend/package.json backend/yarn.lock backend/tsconfig.json /app/backend/
COPY backend/src /app/backend/src
COPY backend_colab/package.json backend_colab/yarn.lock backend_colab/tsconfig.json /app/backend_colab/
COPY backend_colab/src /app/backend_colab/src

# Install backend dependencies
WORKDIR /app/backend
RUN yarn install --frozen-lockfile

WORKDIR /app/backend_colab
RUN yarn install --frozen-lockfile

# Copy startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Expose port 80 (nginx)
EXPOSE 80

CMD ["/start.sh"]
