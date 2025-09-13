const winston = require('winston');

// Conditionally require winston-seq to handle test environment
let SeqTransport;
try {
  SeqTransport = require('winston-seq').Seq;
} catch (error) {
  // Fallback for test environment or if winston-seq is not available
  SeqTransport = null;
}

// Create base transports
const transports = [
  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  new winston.transports.File({ filename: 'logs/combined.log' })
];

// Add Seq transport if available
if (SeqTransport) {
  transports.push(new SeqTransport({
    serverUrl: process.env.SEQ_URL || 'http://localhost:5341',
    apiKey: process.env.SEQ_API_KEY,
    onError: (e) => {
      console.error('Error sending to Seq:', e.message);
    }
  }));
}

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'deckbuilder' },
  transports: transports
});

module.exports = logger;