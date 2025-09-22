import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import logger from '../config/logger';
import DeckModel from '../models/deckSchema';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  sessionId?: string;
}

import { Socket } from 'socket.io';

class SocketService {
  private io: SocketIOServer | null = null;

  public initialize(server: HTTPServer): void {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: ['http://localhost:3001', 'http://localhost:3005'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    this.setupAuthentication();
    this.setupEventHandlers();

    logger.info('Socket.io server initialized');
  }

  private setupAuthentication(): void {
    if (!this.io) return;

    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (token) {
          // Authenticated user
          const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
          socket.userId = decoded.id;
          logger.debug(`Authenticated socket connection for user: ${socket.userId}`);
        } else {
          // Anonymous user - use session ID
          socket.sessionId = socket.id;
          logger.debug(`Anonymous socket connection: ${socket.sessionId}`);
        }

        next();
      } catch (error) {
        logger.error('Socket authentication error:', error);
        // Allow connection but mark as anonymous
        socket.sessionId = socket.id;
        next();
      }
    });
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      logger.info(`Socket connected: ${socket.id}, userId: ${socket.userId || 'anonymous'}`);

      // Handle joining deck-specific rooms
      socket.on('join-deck-room', async (data: { deckId: string }) => {
        try {
          const { deckId } = data;

          // Verify user owns this deck or allow anonymous access for backwards compatibility
          if (socket.userId) {
            const deck = await DeckModel.findOne({
              _id: deckId,
              userId: socket.userId
            });

            if (!deck) {
              socket.emit('error', { message: 'Unauthorized access to deck' });
              return;
            }
          }

          // Create user/session-specific room AND join general deck room
          const userRoomId = socket.userId
            ? `user:${socket.userId}:deck:${deckId}`
            : `session:${socket.sessionId}:deck:${deckId}`;

          const deckRoomId = `deck:${deckId}`;

          socket.join(userRoomId);
          socket.join(deckRoomId);
          socket.emit('joined-deck-room', { deckId, roomId: userRoomId });

          logger.debug(`Socket ${socket.id} joined rooms: ${userRoomId} and ${deckRoomId}`);
        } catch (error) {
          logger.error('Error joining deck room:', error);
          socket.emit('error', { message: 'Failed to join deck room' });
        }
      });

      // Handle leaving deck rooms
      socket.on('leave-deck-room', (data: { deckId: string }) => {
        const { deckId } = data;
        const userRoomId = socket.userId
          ? `user:${socket.userId}:deck:${deckId}`
          : `session:${socket.sessionId}:deck:${deckId}`;

        const deckRoomId = `deck:${deckId}`;

        socket.leave(userRoomId);
        socket.leave(deckRoomId);
        logger.debug(`Socket ${socket.id} left rooms: ${userRoomId} and ${deckRoomId}`);
      });

      socket.on('disconnect', () => {
        logger.debug(`Socket disconnected: ${socket.id}`);
      });
    });
  }

  public emitToRoom(roomId: string, event: string, data: any): void {
    if (this.io) {
      this.io.to(roomId).emit(event, data);
    }
  }

  public emitDeckProgress(userId: string | null, deckId: string, data: any): void {
    // Emit to the general deck room - all clients interested in this deck will receive it
    const deckRoomId = `deck:${deckId}`;
    this.emitToRoom(deckRoomId, 'deck-progress', {
      deckId,
      ...data
    });

    logger.debug(`Emitted deck-progress to room ${deckRoomId}:`, data.type);
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }
}

export default new SocketService();