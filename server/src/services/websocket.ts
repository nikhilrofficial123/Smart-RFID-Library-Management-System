import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import * as db from '../config/db';

import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';

interface ClientConnection {
  ws: WebSocket;
  type: 'client' | 'middleware';
  isHardwareConnected?: boolean;
  lastSeen: number;
}

let clients: ClientConnection[] = [];
let isReaderOnline = false;
let hardwareMonitorInterval: NodeJS.Timeout | null = null;
let directSerialPort: SerialPort | null = null;
let isDirectSerialConnected = false;

function reevaluateReaderStatus() {
  const middlewareOnline = clients.some(
    c => c.type === 'middleware' && c.isHardwareConnected === true && (Date.now() - c.lastSeen < 6000)
  );
  const hardwareOnline = middlewareOnline || isDirectSerialConnected;

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

async function autoConnectDirectSerial() {
  if (directSerialPort && directSerialPort.isOpen) return;

  try {
    const ports = await SerialPort.list();
    const target = ports.find(p => 
      p.path.includes('usbmodem') || 
      p.path.includes('usbserial') || 
      p.path.includes('ttyACM') || 
      (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino'))
    );

    if (target) {
      console.log(`🔌 Auto-connecting direct USB Serial Port: ${target.path}...`);
      const port = new SerialPort({ path: target.path, baudRate: 9600, autoOpen: false });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      port.open((err) => {
        if (err) {
          isDirectSerialConnected = false;
          reevaluateReaderStatus();
          return;
        }

        console.log(`✅ Direct USB Serial Port ${target.path} connected successfully!`);
        directSerialPort = port;
        isDirectSerialConnected = true;
        reevaluateReaderStatus();

        parser.on('data', async (data: string) => {
          const line = data.trim();
          if (line.startsWith('STATUS:RC522_OK') || line.includes('MIFARE') || line.includes('Read personal data') || line.includes('PICC')) {
            if (!isDirectSerialConnected) {
              isDirectSerialConnected = true;
              reevaluateReaderStatus();
            }
          } else if (line.startsWith('STATUS:RC522_ERROR')) {
            if (isDirectSerialConnected) {
              isDirectSerialConnected = false;
              reevaluateReaderStatus();
            }
          } else if (line) {
            isDirectSerialConnected = true;
            reevaluateReaderStatus();

            let cleanUid = line;
            if (cleanUid.includes('Card UID:')) {
              cleanUid = cleanUid.split('Card UID:')[1].trim();
            }
            if (!cleanUid.includes('_')) {
              cleanUid = cleanUid.replace(/\s+/g, '').toUpperCase();
            }
            if (cleanUid.length >= 4) {
              await handleRFIDScan(cleanUid);
            }
          }
        });

        port.on('error', (err) => {
          console.error('Direct Serial Port Error:', err.message);
          isDirectSerialConnected = false;
          directSerialPort = null;
          reevaluateReaderStatus();
        });

        port.on('close', () => {
          console.log('Direct Serial Port Closed.');
          isDirectSerialConnected = false;
          directSerialPort = null;
          reevaluateReaderStatus();
        });
      });
    }
  } catch (err) {
    // Fallback if serial port search error occurs
  }
}

// Start continuous hardware connection check interval
function startHardwareMonitor() {
  if (hardwareMonitorInterval) return;
  
  // Trigger initial direct serial port check
  autoConnectDirectSerial();

  hardwareMonitorInterval = setInterval(() => {
    const now = Date.now();
    let statusChanged = false;

    // Check direct serial port status
    if (!directSerialPort || !directSerialPort.isOpen) {
      if (isDirectSerialConnected) {
        isDirectSerialConnected = false;
        statusChanged = true;
      }
      autoConnectDirectSerial();
    } else {
      try {
        directSerialPort.write('CHECK\n');
      } catch (_) {}
    }

    // Check middleware WebSocket connections
    clients.forEach(client => {
      if (client.type === 'middleware') {
        if (now - client.lastSeen > 6000 && client.isHardwareConnected) {
          client.isHardwareConnected = false;
          statusChanged = true;
        }
      }
    });

    if (statusChanged) {
      reevaluateReaderStatus();
    }
  }, 2500);
}

export function initWebSocket(server: Server) {
  startHardwareMonitor();
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
    const connInfo: ClientConnection = { ws, type: connType, isHardwareConnected: false, lastSeen: Date.now() };
    clients.push(connInfo);

    if (connType === 'middleware') {
      reevaluateReaderStatus();
    } else {
      // Send initial reader status to newly connected client
      ws.send(JSON.stringify({ type: 'reader-status', online: isReaderOnline }));
    }

    ws.on('message', async (message: string) => {
      try {
        connInfo.lastSeen = Date.now();
        const data = JSON.parse(message);

        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', online: isReaderOnline }));
          return;
        }

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
