import WebSocket from 'ws';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const SERVER_WS_URL = process.env.SERVER_WS_URL || 'ws://localhost:5001/rfid';
const SERIAL_PORT = process.env.SERIAL_PORT || ''; // e.g., '/dev/tty.usbmodem1411101' or 'COM3'
const BAUD_RATE = parseInt(process.env.BAUD_RATE || '9600');

let ws: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;
let isHardwareConnected = false;

let activePort: SerialPort | null = null;
let serialReconnectTimer: NodeJS.Timeout | null = null;
let isConnectingSerial = false;

console.log('==================================================');
console.log('📶 RFID Reader Middleware Gateway Starting...');
console.log(`🔌 Target server WebSocket: ${SERVER_WS_URL}`);
console.log('==================================================');

let isRc522ChipHealthy = false;

// Send hardware connection status to Server
function sendHardwareStatus(connected: boolean) {
  isHardwareConnected = connected;
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'hardware-status', isHardwareConnected: connected }));
  }
}

// Continuous Heartbeat & Status Verification Loop (every 2.5 seconds)
setInterval(() => {
  if (activePort && activePort.isOpen) {
    try {
      activePort.write('CHECK\n');
    } catch (_) {}
  } else {
    isRc522ChipHealthy = false;
    sendHardwareStatus(false);
  }
}, 2500);

// Establish WebSocket Connection with Auto Reconnection
function connectWebSocket() {
  console.log('Connecting to Backend WebSocket Gateway...');
  ws = new WebSocket(SERVER_WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to Backend WebSocket successfully.');
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
    // Send current hardware status upon WS connection
    sendHardwareStatus(Boolean(activePort && activePort.isOpen));
  });

  ws.on('close', () => {
    console.log('❌ Backend connection lost. Attempting reconnection in 2.5 seconds...');
    if (!reconnectTimer) {
      reconnectTimer = setInterval(connectWebSocket, 2500);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket connection error:', err.message);
  });
}

connectWebSocket();

// Helper to send scan to Server
function sendRfidScan(rawInput: string) {
  let cleanUid = rawInput.trim();
  if (!cleanUid) return;

  // Handle header text lines from standard MFRC522 dump sketches as proof of connection
  if (cleanUid.includes('MIFARE') || cleanUid.includes('Read personal data') || cleanUid.includes('Firmware Version') || cleanUid.includes('PICC')) {
    console.log(`ℹ️ Hardware Connection Active: ${cleanUid}`);
    isRc522ChipHealthy = true;
    sendHardwareStatus(true);
    return;
  }

  // Handle 'Card UID: 77 92 13 AB' format
  if (cleanUid.includes('Card UID:')) {
    cleanUid = cleanUid.split('Card UID:')[1].trim();
  }

  // Format hex UIDs (remove spaces e.g. "77 92 13 AB" -> "779213AB")
  if (!cleanUid.includes('_')) {
    cleanUid = cleanUid.replace(/\s+/g, '').toUpperCase();
  }

  if (cleanUid.length < 4) return;

  console.log(`📡 Scanned RFID Tag UID: [ ${cleanUid} ]`);
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'scan', uid: cleanUid }));
    console.log(`   Sent to backend successfully.`);
  } else {
    console.warn(`   ⚠️  Backend disconnected. Unable to send UID: ${cleanUid}`);
  }
}

// Dynamic Serial Port Auto-Reconnect Manager
async function tryConnectSerial() {
  if (activePort && activePort.isOpen) return;
  if (isConnectingSerial) return;
  isConnectingSerial = true;

  try {
    const availablePorts = await SerialPort.list();
    let targetPath = SERIAL_PORT;

    if (targetPath) {
      const existsExact = availablePorts.some(p => p.path === targetPath);
      if (!existsExact) {
        // Find matching USB Serial port if path changed upon reconnect
        const matchPort = availablePorts.find(p => 
          p.path.includes('usbmodem') || 
          p.path.includes('usbserial') || 
          p.path.includes('ttyACM') ||
          (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino'))
        );
        if (matchPort) {
          console.log(`Target port ${targetPath} disconnected/changed. Auto-selected USB port: ${matchPort.path}`);
          targetPath = matchPort.path;
        }
      }
    } else {
      // Auto-detect Arduino / USB serial port if SERIAL_PORT not configured
      const matchPort = availablePorts.find(p => 
        p.path.includes('usbmodem') || 
        p.path.includes('usbserial') || 
        p.path.includes('ttyACM') ||
        (p.manufacturer && p.manufacturer.toLowerCase().includes('arduino'))
      );
      if (matchPort) {
        targetPath = matchPort.path;
        console.log(`Auto-detected USB Serial Port: ${targetPath}`);
      }
    }

    if (targetPath && availablePorts.some(p => p.path === targetPath)) {
      console.log(`🔌 Attempting to open physical Serial Port: ${targetPath} @ ${BAUD_RATE} baud...`);
      const port = new SerialPort({ path: targetPath, baudRate: BAUD_RATE, autoOpen: false });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

      port.open((err) => {
        if (err) {
          console.error(`❌ Failed to open Serial Port ${targetPath}:`, err.message);
          sendHardwareStatus(false);
          activePort = null;
          isConnectingSerial = false;
          scheduleSerialReconnect();
          return;
        }

        console.log(`✅ Serial Port ${targetPath} opened. Verifying RC522 SPI IC...`);
        activePort = port;
        isConnectingSerial = false;

        parser.on('data', (data: string) => {
          const line = data.trim();
          if (line.startsWith('STATUS:RC522_OK')) {
            if (!isRc522ChipHealthy) {
              console.log(`✅ RC522 RFID IC verified healthy over SPI! (${line})`);
            }
            isRc522ChipHealthy = true;
            sendHardwareStatus(true);
          } else if (line.startsWith('STATUS:RC522_ERROR')) {
            if (isRc522ChipHealthy || isHardwareConnected) {
              console.warn('⚠️ RC522 SPI IC Error: Module missing, loose SPI wiring, or power issue.');
            }
            isRc522ChipHealthy = false;
            sendHardwareStatus(false);
          } else if (line) {
            isRc522ChipHealthy = true;
            sendHardwareStatus(true);
            sendRfidScan(line);
          }
        });

        port.on('error', (err) => {
          console.error(`❌ Serial Port error:`, err.message);
          handleSerialDisconnect();
        });

        port.on('close', () => {
          console.log(`🔌 Serial Port closed (hardware disconnected).`);
          handleSerialDisconnect();
        });
      });
    } else {
      sendHardwareStatus(false);
      isConnectingSerial = false;
      scheduleSerialReconnect();
    }
  } catch (err: any) {
    console.error(`❌ Error scanning serial ports:`, err.message);
    sendHardwareStatus(false);
    isConnectingSerial = false;
    scheduleSerialReconnect();
  }
}

function handleSerialDisconnect() {
  if (activePort) {
    try { activePort.removeAllListeners(); } catch (_) {}
    activePort = null;
  }
  sendHardwareStatus(false);
  scheduleSerialReconnect();
}

function scheduleSerialReconnect() {
  if (!serialReconnectTimer) {
    serialReconnectTimer = setInterval(() => {
      if (!activePort || !activePort.isOpen) {
        tryConnectSerial();
      }
    }, 3000);
  }
}

// Start Serial Auto-Reconnect Manager
tryConnectSerial();

// CLI Keyboard Simulator Fallback
startCLIKeyboardSimulator();

function startCLIKeyboardSimulator() {
  console.log('\n==================================================');
  console.log('🎹 KEYBOARD SIMULATION MODE ENABLED');
  console.log('   Type an RFID Tag UID and press [Enter] to scan:');
  console.log('   Sample UIDs from seed:');
  console.log('   - Student Cards: STU_CARD_779213, STU_CARD_882312, STU_CARD_991204');
  console.log('   - Book Tags:     BOOK_TAG_1001A, BOOK_TAG_1003A, BOOK_TAG_1005A');
  console.log('==================================================\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('line', (line) => {
    const input = line.trim();
    if (input) {
      sendRfidScan(input);
    }
  });
}
