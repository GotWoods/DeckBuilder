const express = require('express');
const importController = require('../controllers/importController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireAuth, importController.importDeck);

module.exports = router;