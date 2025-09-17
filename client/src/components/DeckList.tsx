import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Deck } from '../types/deck';
import { deckService } from '../services';
import { useAuth } from '../contexts/AuthContext';

const DeckList: React.FC = () => {
  const { user, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDecks = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await deckService.getAllDecks();
      setDecks(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch decks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchDecks();
    }
  }, [authLoading]);

  const handleRefresh = () => {
    fetchDecks();
  };

  const handleImport = () => {
    navigate('/import');
  };

  if (authLoading || loading) {
    return <div style={styles.container}>Loading decks...</div>;
  }

  if (!user) {
    return (
      <div style={styles.container}>
        <div style={styles.unauthenticated}>
          <h1>Welcome to DeckBuilder</h1>
          <p>Please <Link to="/login" style={styles.loginLink}>sign in</Link> to view and manage your decks.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>Error: {error}</div>
        <button onClick={handleRefresh} style={styles.button}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Your Decks</h1>
        <div style={styles.headerRight}>
          <div style={styles.buttonGroup}>
            <button onClick={handleImport} style={styles.importButton}>
              + Import
            </button>
            <button onClick={handleRefresh} style={styles.button}>
              Refresh
            </button>
          </div>
          {user && (
            <div style={styles.userProfile}>
              {user.avatar && (
                <img src={user.avatar} alt={user.name} style={styles.avatar} />
              )}
              <div style={styles.userInfo}>
                <div style={styles.userName}>{user.name}</div>
                <div style={styles.userEmail}>{user.email}</div>
              </div>
              <button onClick={logout} style={styles.logoutButton}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {decks.length === 0 ? (
        <div style={styles.noDecks}>No decks found</div>
      ) : (
        <div style={styles.deckGrid}>
          {decks.map((deck) => (
            <Link key={deck._id} to={`/deck/${deck._id}`} style={styles.deckLink}>
              <div style={styles.deckCard}>
              <div style={styles.deckHeader}>
                <h3>Deck #{deck._id.slice(-6)}</h3>
                <span style={{
                  ...styles.status,
                  ...(deck.Importing ? styles.statusImporting : styles.statusReady)
                }}>
                  {deck.Importing ? 'Importing...' : 'Ready'}
                </span>
              </div>
              
              <div style={styles.deckInfo}>
                <p><strong>Cards:</strong> {deck.Cards.length}</p>
                <p><strong>Created:</strong> {new Date(deck.createdAt).toLocaleDateString()}</p>
              </div>

              <div style={styles.cardList}>
                <h4>Cards:</h4>
                {deck.Cards.slice(0, 5).map((card, index) => (
                  <div key={index} style={styles.cardItem}>
                    {card.Quantity}x {card.Name}
                  </div>
                ))}
                {deck.Cards.length > 5 && (
                  <div style={styles.moreCards}>
                    ... and {deck.Cards.length - 5} more cards
                  </div>
                )}
              </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  button: {
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  error: {
    color: '#dc3545',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
  },
  noDecks: {
    textAlign: 'center' as const,
    color: '#6c757d',
    fontSize: '18px',
    marginTop: '50px',
  },
  deckGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: '20px',
  },
  deckLink: {
    textDecoration: 'none',
    color: 'inherit',
  },
  deckCard: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    transition: 'box-shadow 0.2s, transform 0.2s',
    cursor: 'pointer',
  },
  deckHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
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
    marginBottom: '15px',
    fontSize: '14px',
    color: '#6c757d',
  },
  cardList: {
    marginTop: '15px',
  },
  cardItem: {
    padding: '4px 0',
    fontSize: '14px',
    borderBottom: '1px solid #f0f0f0',
  },
  moreCards: {
    padding: '8px 0',
    fontSize: '12px',
    color: '#6c757d',
    fontStyle: 'italic',
  },
  unauthenticated: {
    textAlign: 'center' as const,
    marginTop: '100px',
  },
  loginLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontWeight: 'bold',
  },
  importButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #dee2e6',
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column' as const,
  },
  userName: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#212529',
  },
  userEmail: {
    fontSize: '12px',
    color: '#6c757d',
  },
  logoutButton: {
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
};

export default DeckList;