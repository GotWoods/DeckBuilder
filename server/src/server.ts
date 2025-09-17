import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import session from 'express-session';
import passport from './config/passport';
import connectDB from './config/database';
import logger from './config/logger';
import importRoutes from './routes/importRoutes';
import deckRoutes from './routes/deckRoutes';
import authRoutes from './routes/authRoutes';
import { optionalAuth } from './middleware/auth';
import deckQueue from './utils/deckQueue';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

connectDB();

// Initialize Redis/Bull queue connection
// The queue events are already set up in deckQueue.js, just ensure it's loaded
logger.info('Initializing queue system...');

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['http://localhost:3005', 'http://localhost:3001'];
  
  if (allowedOrigins.includes(origin as string)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Session configuration for passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Apply optional auth middleware to get user context
app.use(optionalAuth);

app.use('/auth', authRoutes);
app.use('/api/import', importRoutes);
app.use('/api/deck', deckRoutes);

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