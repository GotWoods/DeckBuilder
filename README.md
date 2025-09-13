# Deckbuilder Server

A Node.js server for importing and processing deck data with MongoDB and Redis.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- npm

## Quick Start

1. **Start the databases:**
   ```bash
   docker-compose up -d
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```

4. **Start the background worker (in separate terminal):**
   ```bash
   node workers/deckProcessor.js
   ```

5. **Start the server:**
   ```bash
   npm start
   ```

## Services

- **MongoDB**: `localhost:27017` (admin/password)
- **Redis**: `localhost:6379`
- **Server**: `localhost:3000`

## API Endpoints

### Import Deck
```bash
POST /api/deck/import
Content-Type: application/json

{
  "importData": "4 Lightning Bolt\n2 Counterspell\n1 Black Lotus"
}
```

## Development

- **Stop databases:** `docker-compose down`
- **View logs:** `docker-compose logs -f`
- **Reset data:** `docker-compose down -v`