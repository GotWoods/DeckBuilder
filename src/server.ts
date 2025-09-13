import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import connectDB from './config/database';
import logger from './config/logger';
import importRoutes from './routes/importRoutes';
import deckQueue from './utils/deckQueue';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

// Initialize Redis/Bull queue connection
// The queue events are already set up in deckQueue.js, just ensure it's loaded
logger.info('Initializing queue system...');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/import', importRoutes);

const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('HTTP server closed');
    });
    
    // Close database connection
    await require('mongoose').connection.close();
    logger.info('MongoDB connection closed');
    
    // Close job queue
    await deckQueue.close();
    logger.info('Job queue closed');
    
    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));