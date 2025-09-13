# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Start databases**: `docker-compose up -d`
- **Install dependencies**: `npm install`
- **Start server**: `npm start` (runs on port 3000)
- **Start worker**: `npm run worker` (must run in separate terminal)
- **Stop databases**: `docker-compose down`
- **Reset data**: `docker-compose down -v`
- **Run tests**: `npm test`
- **Watch tests**: `npm run test:watch`
- **Test coverage**: `npm run test:coverage`

## Architecture Overview

This is a Node.js/Express deck import and card pricing system with queue-based processing:

### Core Components

- **Express Server** (`index.js`): HTTP API server with graceful shutdown handling
- **Queue System**: Uses Bull/Redis for background job processing
- **Worker Process** (`workers/deckProcessor.js`): Separate process that handles card pricing
- **Processors**: Pluggable card price fetchers (Face to Face, Taps) extending `BaseProcessor`, returning standardized `CardResult` objects
- **Pricing Storage**: Cards store pricing results as flexible arrays, not tied to specific vendors

### Data Flow

1. Deck text imported via POST `/api/import`
2. Deck parsed and saved to MongoDB with `Importing: true` status
3. Processing job queued in Redis via Bull
4. Worker processes cards in batches of 5 using multiple pricing sources (Face to Face + Taps in parallel)
5. Pricing results saved to individual cards in database after each batch
6. Once all batches complete, deck status updated to `Importing: false`

### Key Files

- `routes/deck.js`: API endpoint for deck imports
- `queues/deckQueue.js`: Bull queue configuration
- `workers/deckProcessor.js`: Background job processor
- `processors/`: Card pricing implementations
- `data/`: MongoDB schemas for decks and cards

### Database Services

- **MongoDB**: `localhost:27017` (admin/password)
- **Redis**: `localhost:6379`

### Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment (development/production)
- `LOG_LEVEL`: Winston log level (default: info)
- `SEQ_URL`: Seq server URL (default: http://localhost:5341)
- `SEQ_API_KEY`: Seq API key for authentication (optional)

Both worker and server processes must run concurrently for full functionality.