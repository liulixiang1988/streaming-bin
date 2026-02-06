# Mock SSE & WebSocket Service

A mock SSE (Server-Sent Events) and WebSocket service for testing purposes.

## Features

- SSE stream connections on any path
- WebSocket echo server with heartbeat
- Interactive WebSocket test page (browser UI)
- Health check endpoints
- Docker containerization support
- Graceful shutdown
- Uses the lightweight `ws` library for WebSocket handling

## Docker Hub

```bash
docker pull liulixiang1988/sse-bin:latest
docker run -d -p 8080:8080 --name mock-sse liulixiang1988/sse-bin:latest
```

## Endpoints

| Path | Method / Protocol | Description |
|------|-------------------|-------------|
| `/health` | GET | Health check (includes WS connection count) |
| `/healthz` | GET | Health check (K8s compatible) |
| `/ready` | GET | Readiness check |
| `/ws-test` | GET | WebSocket test page (browser UI) |
| `/ws` | WebSocket | WebSocket echo endpoint |
| `/*` | ANY | SSE stream (all other paths) |

## WebSocket API

Connect to `ws://localhost:8080/ws` to establish a WebSocket connection.

**Server behavior:**
- On connect: sends `{ type: "connected", message, path, timestamp }`
- On message: echoes back `{ type: "echo", original, timestamp, path }`
- Heartbeat: sends `{ type: "heartbeat", timestamp, connections }` every 5 seconds
- Supports ping/pong frames

**Test page:** Open `http://localhost:8080/ws-test` in a browser for an interactive WebSocket testing UI with:
- Connect/disconnect controls
- Message sending
- Live message log with timestamps
- Connection stats (sent/received counts, duration)

## Local Development

**Prerequisites:** Node.js >= 20.0.0

### 1. Start the server

```bash
cd mock_service

# Install dependencies
npm install

# Run directly
node server.js

# Or run with npm
npm start

# Or run with auto-reload (auto-restart on file changes)
npm run dev

# Specify custom port
PORT=3000 node server.js
```

You should see output like:

```
============================================
Mock SSE & WebSocket Service
============================================
Listening on: http://0.0.0.0:8080

Available endpoints:
  Health check:    http://localhost:8080/health
  SSE test:        http://localhost:8080/any/path
  WebSocket test:  http://localhost:8080/ws-test
  WebSocket API:   ws://localhost:8080/ws
============================================
```

### 2. Test the endpoints

```bash
# Health check
curl http://localhost:8080/health

# SSE stream test (-N disables buffering, Ctrl+C to stop)
curl -N http://localhost:8080/sse/test

# POST request SSE test
curl -N -X POST http://localhost:8080/webhook
```

### 3. Test WebSocket (browser UI)

Open **http://localhost:8080/ws-test** in a browser (must be accessed via HTTP, not by opening the HTML file directly).

1. Click **Connect** — status dot turns green, you'll see a welcome message
2. Type a message and click **Send** (or press Enter) — server echoes it back
3. Observe **heartbeat** messages every 5 seconds
4. Click **Disconnect** to close the connection

> **Note:** Do NOT open `ws-test.html` directly as a file (`file://...`). The WebSocket test page must be served through the running server at `http://localhost:8080/ws-test`, otherwise the WebSocket URL cannot be auto-detected.

## Build & Push Docker Image

```bash
# Build image
docker build -t liulixiang1988/sse-bin:latest .

# Run locally
docker run -d -p 8080:8080 --name mock-sse liulixiang1988/sse-bin:latest

# Push to Docker Hub
docker push liulixiang1988/sse-bin:latest
```

Or use npm scripts:

```bash
npm run docker:build
npm run docker:run
npm run docker:stop
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8080 | Service listening port |
| `HOST` | 0.0.0.0 | Service listening address |
