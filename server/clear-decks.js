const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

async function clearDecks() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://admin:password@localhost:27017/deckbuilder?authSource=admin');
    console.log('Connected to MongoDB');

    // Delete all decks
    const result = await mongoose.connection.db.collection('decks').deleteMany({});
    console.log(`Deleted ${result.deletedCount} decks`);

    // Count remaining decks
    const count = await mongoose.connection.db.collection('decks').countDocuments();
    console.log(`Remaining decks: ${count}`);

    // Close connection
    await mongoose.connection.close();
    console.log('Database connection closed');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearDecks();