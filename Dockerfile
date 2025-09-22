# Multi-stage Docker build for DeckBuilder with embedded MongoDB and Redis

# Stage 1: Build the client (React)
FROM node:20-alpine AS client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm install

# Copy client source code
COPY client/ ./

# Build the React application with production API URL
ENV REACT_APP_API_URL=https://deckbuilder.fly.dev
RUN npm run build

# Stage 2: Build the server (Node.js/TypeScript)
FROM node:20-alpine AS server-builder

WORKDIR /app

# Copy server package files and config
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/

# Install server dependencies
WORKDIR /app/server
RUN npm install

# Copy server source code
COPY server/src/ ./src/

# Build the TypeScript server
RUN npm run build

# Stage 3: Production image with MongoDB and Redis
FROM node:20-slim AS production

WORKDIR /app

# Install MongoDB, Redis, and utilities
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    redis-server \
    curl \
    && wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | apt-key add - \
    && echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update \
    && apt-get install -y mongodb-org \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p /data/db

# Install production dependencies for server
COPY server/package*.json ./
RUN npm install --only=production

# Copy built server from server-builder stage
COPY --from=server-builder /app/dist ./dist

# Copy built client from client-builder stage
COPY --from=client-builder /app/client/dist/frontend ./public

# Copy workers source (needed at runtime)
COPY server/src/workers ./src/workers

# Create startup script
RUN printf '#!/bin/bash\n\
set -e\n\
\n\
# Create MongoDB data directory\n\
echo "Creating MongoDB data directory..."\n\
mkdir -p /data/db\n\
\n\
echo "Starting MongoDB..."\n\
mongod --dbpath /data/db --bind_ip_all --port 27017 &\n\
MONGO_PID=$!\n\
\n\
echo "Starting Redis..."\n\
redis-server --bind 0.0.0.0 --port 6379 &\n\
REDIS_PID=$!\n\
\n\
# Wait for MongoDB to be ready\n\
echo "Waiting for MongoDB to be ready..."\n\
while ! curl -s http://localhost:27017/ > /dev/null; do\n\
  sleep 1\n\
done\n\
\n\
# Wait for Redis to be ready\n\
echo "Waiting for Redis to be ready..."\n\
while ! redis-cli ping > /dev/null 2>&1; do\n\
  sleep 1\n\
done\n\
\n\
echo "Starting worker..."\n\
cd /app\n\
NODE_ENV=production MONGODB_URI=mongodb://localhost:27017/deckbuilder REDIS_URL=redis://localhost:6379 node /app/dist/workers/deckProcessor.js &\n\
WORKER_PID=$!\n\
\n\
echo "Starting server..."\n\
NODE_ENV=production PORT=3000 MONGODB_URI=mongodb://localhost:27017/deckbuilder REDIS_URL=redis://localhost:6379 node /app/dist/server.js &\n\
SERVER_PID=$!\n\
\n\
# Function to cleanup processes on exit\n\
cleanup() {\n\
  echo "Shutting down processes..."\n\
  kill $SERVER_PID $WORKER_PID $REDIS_PID $MONGO_PID 2>/dev/null || true\n\
  wait\n\
}\n\
\n\
# Set up signal handlers\n\
trap cleanup SIGTERM SIGINT\n\
\n\
echo "All services started. Server PID: $SERVER_PID, Worker PID: $WORKER_PID, Redis PID: $REDIS_PID, MongoDB PID: $MONGO_PID"\n\
\n\
# Wait for the server process (main process)\n\
wait $SERVER_PID\n' > /start.sh && chmod +x /start.sh

# Expose the port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start all services with our script
CMD ["/start.sh"]