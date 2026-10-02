import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface RFIDScan {
  uid: string;
  tagType: 'Student' | 'Book' | 'Unknown';
  data: any;
  timestamp: string;
}

interface RFIDContextType {
  isReaderOnline: boolean;
  lastScan: RFIDScan | null;
  clearLastScan: () => void;
  simulateScan: (uid: string) => Promise<void>;
  registerScanListener: (listener: (scan: RFIDScan) => void) => () => void;
}

const RFIDContext = createContext<RFIDContextType | undefined>(undefined);

export const RFIDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { apiUrl } = useAuth();
  const [isReaderOnline, setIsReaderOnline] = useState(false);
  const [lastScan, setLastScan] = useState<RFIDScan | null>(null);
  
  const listenersRef = useRef<((scan: RFIDScan) => void)[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Register local pages callback
  const registerScanListener = (listener: (scan: RFIDScan) => void) => {
    listenersRef.current.push(listener);
    return () => {
      listenersRef.current = listenersRef.current.filter(l => l !== listener);
    };
  };

  const clearLastScan = () => {
    setLastScan(null);
  };

  // Connect WebSockets
  useEffect(() => {
    const connectWS = () => {
      const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:5001') + '/client';
      console.log('Client connecting to WebSocket gateway:', wsUrl);
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'reader-status') {
            setIsReaderOnline(message.online);
          } else if (message.type === 'rfid-scan') {
            const scanResult: RFIDScan = {
              uid: message.uid,
              tagType: message.tagType,
              data: message.data,
              timestamp: message.timestamp
            };
            
            setLastScan(scanResult);
            
            // Execute all active listeners immediately
            listenersRef.current.forEach(listener => listener(scanResult));
          }
        } catch (err) {
          console.error('Error parsing client socket message:', err);
        }
      };

      socket.onclose = () => {
        console.log('WS Connection closed. Reconnecting in 5s...');
        setIsReaderOnline(false);
        setTimeout(connectWS, 5000);
      };

      socket.onerror = (err) => {
        console.error('WS client socket error:', err);
      };
    };

    connectWS();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // API helper to simulate scan from web UI console
  const simulateScan = async (uid: string) => {
    try {
      const res = await fetch(`${apiUrl}/rfid/simulate-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid })
      });
      if (!res.ok) {
        throw new Error('Simulation API rejected card scan');
      }
    } catch (err) {
      console.error('Failed to trigger scan simulation:', err);
    }
  };

  return (
    <RFIDContext.Provider value={{
      isReaderOnline,
      lastScan,
      clearLastScan,
      simulateScan,
      registerScanListener
    }}>
      {children}
    </RFIDContext.Provider>
  );
};

export const useRFID = () => {
  const context = useContext(RFIDContext);
  if (context === undefined) {
    throw new Error('useRFID must be used within an RFIDProvider');
  }
  return context;
};
