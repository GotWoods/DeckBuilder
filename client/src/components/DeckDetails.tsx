import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Deck } from '../types/deck';
import { deckService } from '../services';

const DeckDetails: React.FC = () => {
  const { id: deckId } = useParams<{ id: string }>();
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
    return <div style={styles.container}>Loading deck details...</div>;
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {error}</div>
        <Link to="/" style={styles.backButton}>← Back to Decks</Link>
      </div>
    );
  }

  if (!deck) {
    return (
      <div style={styles.container}>
        <div>Deck not found</div>
        <Link to="/" style={styles.backButton}>← Back to Decks</Link>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={styles.backButton}>← Back to Decks</Link>
        <h1>Deck #{deck._id.slice(-6)}</h1>
        <span style={{
          ...styles.status,
          ...(deck.Importing ? styles.statusImporting : styles.statusReady)
        }}>
          {deck.Importing ? 'Importing...' : 'Ready'}
        </span>
      </div>

      <div style={styles.deckInfo}>
        <p><strong>Total Cards:</strong> {deck.Cards.length}</p>
        <p><strong>Created:</strong> {new Date(deck.createdAt).toLocaleDateString()}</p>
      </div>

      <div style={styles.cardList}>
        <h2>Cards</h2>
        {deck.Cards.map((card, index) => (
          <div key={index} style={styles.cardItem}>
            <div style={styles.cardQuantity}>{card.Quantity}x</div>
            <div style={styles.cardName}>{card.Name}</div>
            {card.Results && card.Results.length > 0 && (
              <div style={styles.cardPricing}>
                {card.Results.map((result, resultIndex) => (
                  <div key={resultIndex} style={styles.priceItem}>
                    <span style={styles.priceVendor}>{result.Vendor}:</span>
                    <span style={styles.priceValue}>${result.Price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '20px',
  },
  backButton: {
    textDecoration: 'none',
    color: '#007bff',
    fontSize: '16px',
    fontWeight: 'bold',
  },
  status: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  statusImporting: {
    backgroundColor: '#fff3cd',
    color: '#856404',
    border: '1px solid #ffeaa7',
  },
  statusReady: {
    backgroundColor: '#d4edda',
    color: '#155724',
    border: '1px solid #c3e6cb',
  },
  deckInfo: {
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '16px',
  },
  cardList: {
    marginTop: '20px',
  },
  cardItem: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '15px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: 'white',
    marginBottom: '5px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardQuantity: {
    minWidth: '50px',
    fontWeight: 'bold',
    color: '#495057',
  },
  cardName: {
    flex: 1,
    fontSize: '16px',
    color: '#333',
  },
  cardPricing: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    minWidth: '150px',
  },
  priceItem: {
    display: 'flex',
    gap: '8px',
    marginBottom: '4px',
  },
  priceVendor: {
    fontSize: '12px',
    color: '#6c757d',
  },
  priceValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#28a745',
  },
  error: {
    color: '#dc3545',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
  },
};

export default DeckDetails;