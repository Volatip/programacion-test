/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { buildWebSocketProtocols, buildWsUrl } from '../lib/api';

interface WebSocketContextType {
  isConnected: boolean;
  sendMessage: (message: string) => void;
  lastMessage: string | null;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    let isMounted = true;

    const connect = () => {
      if (!isMounted || !isAuthenticated || !token) return;

      const protocols = buildWebSocketProtocols(token);
      if (protocols.length === 0) {
        return;
      }

      const ws = new WebSocket(buildWsUrl('/ws/info-bar'), protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) {
          ws.close();
          return;
        }
        console.log('WebSocket Connected');
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        if (isMounted) {
          console.log('WS Message:', event.data);
          setLastMessage(event.data);
        }
      };

      ws.onclose = (event) => {
        if (isMounted) {
          console.log('WebSocket Disconnected');
          setIsConnected(false);
          if (event.code === 1008) {
            console.warn('WebSocket rejected the session. Skipping automatic reconnect.');
            return;
          }
          // Attempt reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            if (isMounted) {
              console.log('Reconnecting WS...');
              connect();
            }
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        if (isMounted) {
          // Changed to warn to be less alarming in console during dev/reloads
          console.warn('WebSocket Error (Check backend status):', error);
        }
        ws.close();
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [isAuthenticated, token]);

  const sendMessage = (message: string) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(message);
    }
  };

  return (
    <WebSocketContext.Provider value={{ isConnected, sendMessage, lastMessage }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
