FROM node:25-alpine

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN yarn build

# Create data and files directories
RUN mkdir -p /app/data /app/files

# Expose port
EXPOSE 3003

# Start the server
CMD ["node", "dist/index.js"]
