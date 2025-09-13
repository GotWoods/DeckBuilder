// Test fixtures for deck data
module.exports = {
  simpleDeck: '4 Lightning Bolt\n2 Counterspell\n1 Black Lotus',
  
  complexDeck: `4 Lightning Bolt
2 Counterspell  
1 Black Lotus
3 Serra the Benevolent
1 Jace, the Mind Sculptor`,

  deckWithEmptyLines: `4 Lightning Bolt

2 Counterspell
   
1 Black Lotus`,

  invalidDeck: `4 Lightning Bolt
InvalidLine
2 Counterspell
AnotherInvalidLine`,

  expectedSimpleDeck: [
    { Quantity: 4, Name: 'Lightning Bolt' },
    { Quantity: 2, Name: 'Counterspell' },
    { Quantity: 1, Name: 'Black Lotus' }
  ],

  expectedComplexDeck: [
    { Quantity: 4, Name: 'Lightning Bolt' },
    { Quantity: 2, Name: 'Counterspell' },
    { Quantity: 1, Name: 'Black Lotus' },
    { Quantity: 3, Name: 'Serra the Benevolent' },
    { Quantity: 1, Name: 'Jace, the Mind Sculptor' }
  ]
};