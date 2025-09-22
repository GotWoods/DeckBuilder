import { createClient } from 'redis';
import logger from '../config/logger';
import socketService from './socketService';

interface ProgressEvent {
  userId?: string;
  deckId: string;
  type: 'start' | 'batch' | 'card' | 'complete' | 'error';
  progress?: number;
  message?: string;
}

class ProgressService {
  private publisher: ReturnType<typeof createClient> | null = null;
  private subscriber: ReturnType<typeof createClient> | null = null;
  private readonly PROGRESS_CHANNEL = 'deck-progress';

  public async initialize(): Promise<void> {
    try {
      // Create Redis clients for pub/sub
      this.publisher = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      this.subscriber = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379'
      });

      // Connect clients
      await this.publisher.connect();
      await this.subscriber.connect();

      // Subscribe to progress events
      await this.subscriber.subscribe(this.PROGRESS_CHANNEL, (message) => {
        logger.info(`Progress service received Redis message: ${message}`);
        this.handleProgressEvent(message);
      });

      logger.info('Progress service initialized with Redis pub/sub');
    } catch (error) {
      logger.error('Failed to initialize progress service:', error);
      throw error;
    }
  }

  private handleProgressEvent(message: string): void {
    try {
      const event: ProgressEvent = JSON.parse(message);

      logger.info(`Handling progress event for deck ${event.deckId}: ${event.type} - ${event.message}`);

      // Emit to specific user's room via Socket.io
      socketService.emitDeckProgress(event.userId || null, event.deckId, {
        type: event.type,
        progress: event.progress,
        message: event.message
      });
    } catch (error) {
      logger.error('Error handling progress event:', error);
    }
  }

  public async publishProgress(event: ProgressEvent): Promise<void> {
    if (!this.publisher) {
      logger.warn('Progress publisher not initialized');
      return;
    }

    try {
      await this.publisher.publish(this.PROGRESS_CHANNEL, JSON.stringify(event));
      logger.debug(`Published progress event for deck ${event.deckId}:`, event.type);
    } catch (error) {
      logger.error('Error publishing progress event:', error);
    }
  }

  // Helper methods for different event types
  public async publishStart(userId: string | undefined, deckId: string, totalCards: number): Promise<void> {
    await this.publishProgress({
      userId,
      deckId,
      type: 'start',
      progress: 0
    });
  }

  public async publishBatch(
    userId: string | undefined,
    deckId: string,
    batchNumber: number,
    totalBatches: number,
    cardsProcessed: number,
    totalCards: number
  ): Promise<void> {
    const progress = Math.round((cardsProcessed / totalCards) * 100);

    await this.publishProgress({
      userId,
      deckId,
      type: 'batch',
      progress
    });
  }

  public async publishCard(
    userId: string | undefined,
    deckId: string,
    cardName: string,
    cardIndex: number,
    totalCards: number,
    resultsFound: number
  ): Promise<void> {
    const progress = Math.round(((cardIndex + 1) / totalCards) * 100);

    await this.publishProgress({
      userId,
      deckId,
      type: 'card',
      progress
    });
  }

  public async publishComplete(
    userId: string | undefined,
    deckId: string,
    totalCards: number,
    processorResults: Record<string, number>
  ): Promise<void> {
    await this.publishProgress({
      userId,
      deckId,
      type: 'complete',
      progress: 100
    });
  }

  public async publishError(
    userId: string | undefined,
    deckId: string,
    error: string
  ): Promise<void> {
    await this.publishProgress({
      userId,
      deckId,
      type: 'error',
      message: error
    });
  }

  public async close(): Promise<void> {
    try {
      if (this.subscriber) {
        await this.subscriber.unsubscribe(this.PROGRESS_CHANNEL);
        await this.subscriber.disconnect();
      }
      if (this.publisher) {
        await this.publisher.disconnect();
      }
      logger.info('Progress service closed');
    } catch (error) {
      logger.error('Error closing progress service:', error);
    }
  }
}

export default new ProgressService();