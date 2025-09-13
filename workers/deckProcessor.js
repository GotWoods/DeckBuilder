const deckQueue = require('../queues/deckQueue');
const Deck = require('../data/deckSchema');
const FaceToFaceProcessor = require('../processors/faceToFaceProcessor');
const TapsProcessor = require('../processors/tapsProcessor');

const f2fProcessor = new FaceToFaceProcessor();
const tapsProcessor = new TapsProcessor();

deckQueue.process('processDeck', async (job) => {
  try {
    const { deckId } = job.data;
    console.log(`Processing deck: ${deckId}`);
    
    // Find the deck in the database
    const deck = await Deck.findById(deckId);
    if (!deck) {
      throw new Error(`Deck ${deckId} not found`);
    }
    
    console.log(`Found deck with ${deck.Cards.length} cards`);
    
    // Process cards with both Face to Face and Taps pricing
    console.log('Processing cards with Face to Face...');
    const f2fResults = await f2fProcessor.processCards(deck.Cards);
    
    console.log('Processing cards with Taps...');
    const tapsResults = await tapsProcessor.processCards(deck.Cards);
    
    // Combine results
    const combinedResults = deck.Cards.map((card, index) => ({
      ...card,
      priceData: {
        faceToFace: f2fResults[index].priceData,
        taps: tapsResults[index].tapsData
      }
    }));
    
    // Log the results
    combinedResults.forEach(cardResult => {
      const f2fFound = cardResult.priceData.faceToFace.found;
      const tapsFound = cardResult.priceData.taps.found;
      const f2fCount = f2fFound ? cardResult.priceData.faceToFace.prices.length : 0;
      const tapsCount = tapsFound ? cardResult.priceData.taps.prices.length : 0;
      
      console.log(`${cardResult.Quantity}x ${cardResult.Name}: F2F(${f2fCount}) Taps(${tapsCount})`);
    });
    
    // Update deck status
    deck.Importing = false;
    await deck.save();
    
    console.log(`Deck ${deckId} processing completed`);
    return { 
      success: true, 
      deckId, 
      cardsProcessed: deck.Cards.length,
      faceToFaceResults: f2fResults.filter(c => c.priceData.found).length,
      tapsResults: tapsResults.filter(c => c.tapsData.found).length
    };
    
  } catch (error) {
    console.error(`Error processing deck ${job.data.deckId}:`, error);
    throw error;
  }
});

// Handle job completion
deckQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result);
});

// Handle job failures
deckQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

console.log('Deck processor worker started');