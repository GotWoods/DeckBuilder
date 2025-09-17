const winston = require('winston');

// Create base transports
const transports = [
  new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
  new winston.transports.File({ filename: 'logs/combined.log' })
];

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
  transports.push(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Add Seq transport if URL is configured
if (process.env.SEQ_URL) {
  try {
    // For @datalust/winston-seq, import the default export
    const seqTransport = require('@datalust/winston-seq');

    transports.push(seqTransport({
      serverUrl: process.env.SEQ_URL,
      apiKey: process.env.SEQ_API_KEY,
      onError: (e => {
        console.error('Seq logging error:', e);
      })
    }));
    console.log('Seq logging enabled');
  } catch (err) {
    console.warn('Failed to load winston-seq, skipping Seq logging:', err.message);
  }
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