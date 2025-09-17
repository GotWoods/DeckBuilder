import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import apiService from '../services/apiService';

const DeckImport: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [deckText, setDeckText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!deckText.trim()) {
      setError('Please enter a deck list');
      return;
    }

    try {
      setImporting(true);
      setError(null);

      const response = await apiService.post('/api/import', {
        importData: deckText
      });

      // Redirect to the new deck
      if (response.deckId) {
        navigate(`/deck/${response.deckId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to import deck';
      setError(errorMessage);
    } finally {
      setImporting(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1>Import Deck</h1>
        {user && (
          <div style={styles.userInfo}>
            {user.avatar && (
              <img src={user.avatar} alt={user.name} style={styles.avatar} />
            )}
            <span style={styles.userName}>{user.name}</span>
          </div>
        )}
      </div>

      <div style={styles.form}>
        <label style={styles.label}>
          Paste your deck list below:
        </label>
        <textarea
          value={deckText}
          onChange={(e) => setDeckText(e.target.value)}
          placeholder={`Example:
4 Lightning Bolt
2 Counterspell
1 Black Lotus
...`}
          style={styles.textarea}
          disabled={importing}
        />

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div style={styles.buttonGroup}>
          <button
            onClick={handleCancel}
            style={styles.cancelButton}
            disabled={importing}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            style={styles.importButton}
            disabled={importing || !deckText.trim()}
          >
            {importing ? 'Importing...' : 'Import Deck'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
  },
  userName: {
    fontWeight: 'bold' as const,
    fontSize: '14px',
  },
  form: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  label: {
    display: 'block',
    marginBottom: '10px',
    fontWeight: 'bold' as const,
    fontSize: '16px',
  },
  textarea: {
    width: '100%',
    height: '300px',
    padding: '15px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    marginBottom: '20px',
  },
  error: {
    color: '#dc3545',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
  },
  buttonGroup: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  importButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
};

export default DeckImport;