import React, { useState, useEffect } from 'react';
import { Deck } from '../types/deck';
import { deckService } from '../services';

interface DeckDetailsProps {
  deckId?: string;
}

const DeckDetails: React.FC<DeckDetailsProps> = ({ deckId }) => {
  const [deck, setDeck] = useState<Deck | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDeck = async () => {
      if (!deckId) {
        setError('No deck ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await deckService.getDeckById(deckId);
        setDeck(data);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deck';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [deckId]);

  if (loading) {
    return <div>Loading deck details...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <div>
      <h2>Deck Details</h2>
      {deck?.Cards.map((card, index) => (
        <div key={index}>
          {card.Quantity}x {card.Name}
        </div>
      ))}
    </div>
  );
};

export default DeckDetails;