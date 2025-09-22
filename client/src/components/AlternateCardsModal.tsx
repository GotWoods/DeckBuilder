import React, { useState, useEffect } from 'react';
import { deckService } from '../services';
import SearchCriteriaBuilder from './SearchCriteriaBuilder';

interface AlternateCard {
  id: string;
  name: string;
  image_uris?: {
    small: string;
    normal: string;
  };
}

interface AlternateCardsModalProps {
  cardName: string;
  deckColorIdentity: string[];
  excludeCards: string[];
  onSubstitute: (selectedCard: AlternateCard) => void;
  onClose: () => void;
}

const AlternateCardsModal: React.FC<AlternateCardsModalProps> = ({
  cardName,
  deckColorIdentity,
  excludeCards,
  onSubstitute,
  onClose
}) => {
  const [cardAnalysis, setCardAnalysis] = useState<any>(null);
  const [alternateResults, setAlternateResults] = useState<AlternateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  // Auto-execute search on mount
  useEffect(() => {
    const executeInitialSearch = async () => {
      try {
        setLoading(true);
        setError(null);

        // Analyze the card first
        const analysis = await deckService.analyzeCard(cardName);
        setCardAnalysis(analysis);

        // Auto-search with basic criteria
        const searchCriteria = {
          cardTypes: analysis.types.cardTypes || [],
          powerMin: analysis.power ? parseInt(analysis.power) : undefined,
          powerMax: analysis.power ? parseInt(analysis.power) : undefined,
          toughnessMin: analysis.toughness ? parseInt(analysis.toughness) : undefined,
          toughnessMax: analysis.toughness ? parseInt(analysis.toughness) : undefined,
          requiredKeywords: analysis.keywords || [],
          oracleTextContains: [],
          damageAmount: analysis.abilities.damageAmount || undefined,
          colorIdentity: deckColorIdentity,
          exactColors: false,
          excludeCards
        };

        const results = await deckService.searchAlternatives(searchCriteria);
        setAlternateResults(results);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to search for alternatives';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    executeInitialSearch();
  }, [cardName, deckColorIdentity, excludeCards]);

  // Handle custom search from criteria builder
  const handleCustomSearch = async (criteria: any) => {
    try {
      setLoading(true);
      setError(null);

      const searchCriteria = {
        ...criteria,
        colorIdentity: deckColorIdentity,
        exactColors: false,
        excludeCards
      };

      const results = await deckService.searchAlternatives(searchCriteria);
      setAlternateResults(results);
      setShowCriteria(false); // Hide criteria after search
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search for alternatives';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle clicking outside modal to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Handle ESC key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div style={styles.backdrop} onClick={handleBackdropClick}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h3>Find Alternatives to "{cardName}"</h3>
          <div style={styles.headerButtons}>
            {!showCriteria && !loading && (
              <button
                onClick={() => setShowCriteria(true)}
                style={styles.refineButton}
              >
                Refine Search
              </button>
            )}
            <button onClick={onClose} style={styles.closeButton}>×</button>
          </div>
        </div>

        <div style={styles.content}>
          {/* Show search criteria builder */}
          {showCriteria && cardAnalysis && (
            <SearchCriteriaBuilder
              cardAnalysis={cardAnalysis}
              onSearch={handleCustomSearch}
              onCancel={() => setShowCriteria(false)}
              isLoading={loading}
            />
          )}

          {/* Show results only when not showing criteria */}
          {!showCriteria && (
            <>
              {loading && (
                <div style={styles.loading}>
                  <div>Searching for alternatives...</div>
                </div>
              )}

              {error && (
                <div style={styles.error}>
                  Error: {error}
                </div>
              )}

              {!loading && !error && alternateResults.length === 0 && (
                <div style={styles.noResults}>
                  No alternatives found for the current criteria.
                </div>
              )}
            </>
          )}

          {!showCriteria && !loading && alternateResults.length > 0 && (
            <div style={styles.cardGrid}>
              {alternateResults.map((card) => (
                <div
                  key={card.id}
                  style={styles.cardItem}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.2)';
                    e.currentTarget.style.borderColor = '#007bff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onClick={() => onSubstitute(card)}
                >
                  {card.image_uris ? (
                    <img
                      src={card.image_uris.normal}
                      alt={card.name}
                      style={styles.cardImage}
                    />
                  ) : (
                    <div style={styles.noImageCard}>
                      <div style={styles.cardNameFallback}>{card.name}</div>
                    </div>
                  )}
                  <div style={styles.cardName}>{card.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    maxWidth: '90vw',
    maxHeight: '90vh',
    width: '1000px',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  headerButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  refineButton: {
    padding: '8px 16px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6c757d',
    padding: '0',
    width: '30px',
    height: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: '20px',
    flex: 1,
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    color: '#dc3545',
    textAlign: 'center' as const,
    padding: '20px',
    fontSize: '16px',
  },
  noResults: {
    textAlign: 'center' as const,
    padding: '40px',
    color: '#6c757d',
    fontSize: '16px',
  },
  cardGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '20px',
    padding: '10px',
  },
  cardItem: {
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: '#f8f9fa',
    border: '2px solid transparent',
  },
  cardImage: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '8px 8px 0 0',
  },
  noImageCard: {
    width: '100%',
    height: '280px',
    backgroundColor: '#e9ecef',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px 8px 0 0',
  },
  cardNameFallback: {
    textAlign: 'center' as const,
    padding: '20px',
    fontWeight: 'bold',
    color: '#495057',
  },
  cardName: {
    padding: '10px',
    textAlign: 'center' as const,
    fontWeight: 'bold',
    fontSize: '14px',
    backgroundColor: 'white',
    borderRadius: '0 0 8px 8px',
  },
};

export default AlternateCardsModal;