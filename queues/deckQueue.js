const Bull = require('bull');
const redisConfig = require('../config/redis');

const deckQueue = new Bull('deck processing', {
  redis: redisConfig
});

module.exports = deckQueue;