const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

// Service start time for health check
const startTime = new Date();

// Track active WebSocket connections
const wsConnections = new Set();

// ============================================
// HTTP Handlers
// ============================================

/**
 * Handle health check request
 */
function handleHealth(req, res) {
  const healthInfo = {
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    websocket_connections: wsConnections.size
  };

  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(healthInfo, null, 2));
}

/**
 * Handle SSE stream request
 */
function handleSSE(req, res) {
  console.log(`[SSE] Request received: [${req.method}] ${req.url}`);

  // Respond with SSE format
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Allow-Headers': '*',
    'X-Accel-Buffering': 'no'
  });

  // Send initial confirmation
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    message: 'Connection established',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Send heartbeat every 2 seconds
  const timer = setInterval(() => {
    const payload = {
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      path: req.url,
      method: req.method
    };
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }, 2000);

  // Clean up on connection close
  req.on('close', () => {
    clearInterval(timer);
    console.log(`[SSE] Connection closed: ${req.url}`);
  });
}

/**
 * Handle CORS preflight request
 */
function handleCORS(req, res) {
  res.writeHead(204, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  });
  res.end();
}

/**
 * Serve the WebSocket test page
 */
const wsTestPagePath = path.join(__dirname, 'ws-test.html');
function handleWSTestPage(req, res) {
  fs.readFile(wsTestPagePath, 'utf8', (err, html) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Failed to load ws-test.html');
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.end(html);
  });
}

// ============================================
// WebSocket Server (ws library)
// ============================================

function setupWebSocketServer(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = (req && req.url ? req.url : '/').split('?')[0];

    console.log(`[WS] Connection opened: ${url}`);
    wsConnections.add(ws);

    // Send welcome message
    try {
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket connection established',
        path: url,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      // Ignore send errors on handshake
    }

    // Heartbeat timer
    const heartbeatTimer = setInterval(() => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'heartbeat',
          timestamp: new Date().toISOString(),
          connections: wsConnections.size
        }));
      }
    }, 5000);

    ws.on('message', (data) => {
      const message = data.toString();
      console.log(`[WS] Received: ${message}`);

      let parsedMessage;
      try {
        parsedMessage = JSON.parse(message);
      } catch {
        parsedMessage = message;
      }

      const response = {
        type: 'echo',
        original: parsedMessage,
        timestamp: new Date().toISOString(),
        path: url
      };

      try {
        ws.send(JSON.stringify(response));
      } catch (e) {
        // Ignore send errors
      }
    });

    ws.on('close', () => {
      clearInterval(heartbeatTimer);
      wsConnections.delete(ws);
      console.log(`[WS] Connection closed: ${url} (active: ${wsConnections.size})`);
    });

    ws.on('error', (err) => {
      clearInterval(heartbeatTimer);
      wsConnections.delete(ws);
      console.log(`[WS] Error on ${url}: ${err.message}`);
    });
  });

  return wss;
}

// ============================================
// Main Server
// ============================================

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0]; // Remove query params

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCORS(req, res);
  }

  // Health check endpoints
  if (url === '/health' || url === '/healthz' || url === '/ready') {
    return handleHealth(req, res);
  }

  // WebSocket test page
  if (url === '/ws-test') {
    return handleWSTestPage(req, res);
  }

  // All other requests return SSE stream
  return handleSSE(req, res);
});

// WebSocket server
const wsServer = setupWebSocketServer(server);

// ============================================
// Graceful Shutdown
// ============================================

function shutdown(signal) {
  console.log(`Received ${signal} signal, shutting down...`);

  // Close WebSocket server and all connections
  try {
    wsServer.clients.forEach((client) => {
      try {
        client.close(1001, 'Server shutting down');
      } catch {
        // Ignore
      }
    });
    wsServer.close();
  } catch {
    // Ignore
  }
  wsConnections.clear();

  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ============================================
// Start Server
// ============================================

server.listen(PORT, HOST, () => {
  console.log('============================================');
  console.log('Mock SSE & WebSocket Service');
  console.log('============================================');
  console.log(`  HTTP:  http://${HOST}:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  Health check:    http://localhost:${PORT}/health`);
  console.log(`  SSE test:        http://localhost:${PORT}/any/path`);
  console.log(`  WebSocket test:  http://localhost:${PORT}/ws-test`);
  console.log(`  WebSocket API:   ws://localhost:${PORT}/ws`);
  console.log('');
  console.log('Test commands:');
  console.log(`  curl http://localhost:${PORT}/health`);
  console.log(`  curl -N http://localhost:${PORT}/sse/test`);
  console.log(`  Open http://localhost:${PORT}/ws-test in a browser`);
  console.log('============================================');
});

