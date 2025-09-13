const winston = require('winston');

// Conditionally require winston-seq to handle test environment
let SeqTransport;
try {
  SeqTransport = require('winston-seq').SeqTransport;
} catch (error) {
  // Fallback for test environment or if winston-seq is not available
  SeqTransport = null;
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'deckbuilder' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    ...(SeqTransport ? [new SeqTransport({
      serverUrl: process.env.SEQ_URL || 'http://localhost:5341',
      apiKey: process.env.SEQ_API_KEY,
      onError: (e) => {
        console.error('Error sending to Seq:', e.message);
      }
    })] : [])
  ],
});

// If we're not in production, log to the console with a simple format
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

module.exports = logger;