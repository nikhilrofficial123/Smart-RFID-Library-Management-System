import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import apiRouter from './routes/api';
import { initDatabase } from './config/db';
import { initWebSocket } from './services/websocket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middlewares
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({ origin: corsOrigin })); // Set CORS_ORIGIN env var in production

app.use(express.json({ limit: '10mb' })); // Support uploads in JSON bodies

// Register Router
app.use('/api', apiRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Smart RFID Library Server running smoothly' });
});

const server = http.createServer(app);

// Initialize DB and WebSockets
async function startServer() {
  try {
    await initDatabase();
    initWebSocket(server);
    
    server.listen(PORT, () => {
      console.log(`==================================================`);
      console.log(`🚀 Smart RFID Library Server Running on Port ${PORT}`);
      console.log(`   REST API: http://localhost:${PORT}/api`);
      console.log(`   WebSocket Gateway: ws://localhost:${PORT}`);
      console.log(`==================================================`);
    });
  } catch (err) {
    console.error('Critical Server Startup Failure:', err);
    process.exit(1);
  }
}

startServer();
