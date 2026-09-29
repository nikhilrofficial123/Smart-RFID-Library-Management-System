import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import * as db from '../config/db';

interface ClientConnection {
  ws: WebSocket;
  type: 'client' | 'middleware';
  isHardwareConnected?: boolean;
}

let clients: ClientConnection[] = [];
let isReaderOnline = false;

function reevaluateReaderStatus() {
  const hardwareOnline = clients.some(c => c.type === 'middleware' && c.isHardwareConnected === true);
  if (isReaderOnline !== hardwareOnline) {
    isReaderOnline = hardwareOnline;
    broadcastReaderStatus();
    if (!isReaderOnline) {
      logSystemNotification('RFID Reader Hardware went offline.', 'ReaderOffline');
    } else {
      logSystemNotification('RFID Reader Hardware connected online.', 'ReaderOnline');
    }
  }
}

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (url.pathname === '/rfid' || url.pathname === '/middleware') {
        wss.emit('connection', ws, 'middleware');
      } else {
        wss.emit('connection', ws, 'client');
      }
    });
  });

  wss.on('connection', (ws: WebSocket, type: 'client' | 'middleware' | any) => {
    // Determine connection type based on path or parameter
    const connType: 'client' | 'middleware' = 
      (typeof type === 'string' && (type === 'client' || type === 'middleware')) 
        ? type 
        : 'client';
    
    console.log(`New WS connection established. Type: ${connType}`);
    const connInfo: ClientConnection = { ws, type: connType, isHardwareConnected: false };
    clients.push(connInfo);

    if (connType === 'middleware') {
      reevaluateReaderStatus();
    } else {
      // Send initial reader status to newly connected client
      ws.send(JSON.stringify({ type: 'reader-status', online: isReaderOnline }));
    }

    ws.on('message', async (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log('WS Message received:', data);

        if (connType === 'middleware') {
          if (data.type === 'hardware-status') {
            connInfo.isHardwareConnected = Boolean(data.isHardwareConnected);
            reevaluateReaderStatus();
          } else if (data.type === 'scan' && data.uid) {
            await handleRFIDScan(data.uid);
          }
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      console.log(`WS connection closed. Type: ${connType}`);
      clients = clients.filter(c => c.ws !== ws);
      
      if (connType === 'middleware') {
        reevaluateReaderStatus();
      }
    });
  });
}

// Function to lookup tag and broadcast scan
async function handleRFIDScan(uid: string) {
  try {
    // 1. Check if UID is a registered tag
    const tags = await db.query('SELECT * FROM RFIDTags WHERE uid = ?', [uid]);
    let tagType = 'Unknown';
    let dataPayload: any = null;

    if (tags.length > 0) {
      const tag = tags[0];
      tagType = tag.type; // 'Student' or 'Book'
      const linkedId = tag.linked_id;

      if (tagType === 'Student' && linkedId) {
        const students = await db.query('SELECT * FROM Students WHERE id = ?', [linkedId]);
        if (students.length > 0) {
          dataPayload = students[0];
        }
      } else if (tagType === 'Book' && linkedId) {
        const books = await db.query('SELECT * FROM Books WHERE id = ?', [linkedId]);
        if (books.length > 0) {
          dataPayload = books[0];
        }
      }
    } else {
      // Unregistered Tag scanned
      console.log(`Scanned tag ${uid} is not linked to any entity`);
    }

    // 2. Broadcast the scan detail to all clients
    const scanBroadcast = JSON.stringify({
      type: 'rfid-scan',
      uid,
      tagType,
      data: dataPayload,
      timestamp: new Date().toISOString()
    });

    clients.forEach(client => {
      if (client.type === 'client' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(scanBroadcast);
      }
    });
  } catch (err) {
    console.error('Error handling RFID Scan:', err);
  }
}

// Broadcast readers online status
function broadcastReaderStatus() {
  const statusMessage = JSON.stringify({ type: 'reader-status', online: isReaderOnline });
  clients.forEach(client => {
    if (client.type === 'client' && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(statusMessage);
    }
  });
}

// Log notification to database and broadcast to students/users
async function logSystemNotification(message: string, type: string) {
  try {
    await db.query(
      'INSERT INTO Notifications (user_id, message, type, status) VALUES (?, ?, ?, ?)',
      [1, message, type, 'Unread']
    );
    // Broadcast notification to clients
    const notificationMsg = JSON.stringify({
      type: 'notification',
      message: { message, type, created_at: new Date().toISOString() }
    });
    clients.forEach(client => {
      if (client.type === 'client' && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(notificationMsg);
      }
    });
  } catch (err) {
    console.error('Error inserting system notification:', err);
  }
}

// Trigger standard WebSocket simulated scans from inside the backend routes (API triggered scans)
export async function simulateBackendScan(uid: string) {
  console.log(`Simulating RFID Scan for UID: ${uid}`);
  await handleRFIDScan(uid);
}
