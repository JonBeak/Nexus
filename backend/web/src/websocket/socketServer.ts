/**
 * Socket.io Server Configuration
 *
 * Provides real-time WebSocket communication for Tasks Table synchronization.
 * Uses JWT authentication matching the existing auth middleware pattern.
 */

import { Server as HttpServer } from 'http';
import { Server as HttpsServer } from 'https';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types';

// Socket.io server instance - exported for use by broadcast helpers
let io: SocketIOServer | null = null;

// Extend Socket type to include our custom data
interface AuthenticatedSocket extends Socket {
  data: {
    userId: number;
  };
}

/**
 * Initialize Socket.io server with JWT authentication
 */
export const initializeSocketServer = (
  httpServer: HttpServer | HttpsServer,
  allowedOrigins: string[]
): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true
    },
    // Transport configuration
    transports: ['websocket', 'polling'],
    // Ping/pong for connection health
    pingTimeout: 60000,
    pingInterval: 25000
  });

  // JWT Authentication middleware
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      console.log('🔌 WebSocket: Connection rejected - no token');
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
      (socket as AuthenticatedSocket).data.userId = decoded.userId;
      next();
    } catch (error) {
      console.log('🔌 WebSocket: Connection rejected - invalid token');
      next(new Error('Invalid or expired token'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const authSocket = socket as AuthenticatedSocket;
    const userId = authSocket.data.userId;

    console.log(`🔌 WebSocket: User ${userId} connected (socket: ${socket.id})`);

    // Automatically join user-specific room for targeted notifications
    socket.join(`user:${userId}`);
    console.log(`🔌 WebSocket: User ${userId} auto-joined user:${userId} room`);

    // Join tasks-table room for real-time task updates
    socket.on('join:tasks-table', () => {
      socket.join('tasks-table');
      console.log(`🔌 WebSocket: User ${userId} joined tasks-table room`);
    });

    // Leave tasks-table room
    socket.on('leave:tasks-table', () => {
      socket.leave('tasks-table');
      console.log(`🔌 WebSocket: User ${userId} left tasks-table room`);
    });

    // Join edit-requests room for managers to receive edit request notifications
    socket.on('join:edit-requests', () => {
      socket.join('edit-requests');
      console.log(`🔌 WebSocket: User ${userId} joined edit-requests room`);
    });

    // Leave edit-requests room
    socket.on('leave:edit-requests', () => {
      socket.leave('edit-requests');
      console.log(`🔌 WebSocket: User ${userId} left edit-requests room`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 WebSocket: User ${userId} disconnected (reason: ${reason})`);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`🔌 WebSocket: Error for user ${userId}:`, error);
    });
  });

  console.log('🔌 WebSocket: Socket.io server initialized');

  return io;
};

/**
 * Get the Socket.io server instance
 * Returns null if not yet initialized
 */
export const getSocketServer = (): SocketIOServer | null => {
  return io;
};

/**
 * Check if Socket.io server is initialized
 */
export const isSocketServerReady = (): boolean => {
  return io !== null;
};
