import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import Cookies from 'js-cookie';

interface ProgressEvent {
  deckId: string;
  type: 'start' | 'batch' | 'card' | 'complete' | 'error';
  progress?: number;
  message: string;
  data?: any;
}

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  joinDeckRoom: (deckId: string) => void;
  leaveDeckRoom: (deckId: string) => void;
  onProgress: (callback: (event: ProgressEvent) => void) => void;
  offProgress: (callback: (event: ProgressEvent) => void) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Get auth token
    const token = Cookies.get('auth_token');

    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
      auth: {
        token: token || null
      },
      transports: ['websocket', 'polling']
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('error', (error: any) => {
      console.error('Socket error:', error);
    });

    newSocket.on('joined-deck-room', (data: { deckId: string; roomId: string }) => {
      console.log('Joined deck room:', data);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.close();
    };
  }, []);

  const joinDeckRoom = (deckId: string) => {
    if (socket) {
      console.log('Joining deck room:', deckId);
      socket.emit('join-deck-room', { deckId });
    }
  };

  const leaveDeckRoom = (deckId: string) => {
    if (socket) {
      socket.emit('leave-deck-room', { deckId });
    }
  };

  const onProgress = (callback: (event: ProgressEvent) => void) => {
    if (socket) {
      console.log('Setting up deck-progress listener');
      socket.on('deck-progress', (event) => {
        console.log('Received deck-progress event:', event);
        callback(event);
      });
    }
  };

  const offProgress = (callback: (event: ProgressEvent) => void) => {
    if (socket) {
      socket.off('deck-progress', callback);
    }
  };

  const value: SocketContextType = {
    socket,
    connected,
    joinDeckRoom,
    leaveDeckRoom,
    onProgress,
    offProgress
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};