# ========================================
# Mock SSE Service
# ========================================
FROM node:22-alpine

# Install curl for health check and clean up cache
RUN apk add --no-cache curl && \
    rm -rf /var/cache/apk/*

# Set environment variables
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy application code
COPY package.json server.js ws-test.html ./

# Install dependencies
RUN npm install --omit=dev && \
    npm cache clean --force

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set stop signal for graceful shutdown
STOPSIGNAL SIGTERM

# Start service
CMD ["node", "server.js"]

# Metadata labels
LABEL maintainer="dev@example.com" \
      version="1.0.0" \
      description="Mock SSE Service for testing"
