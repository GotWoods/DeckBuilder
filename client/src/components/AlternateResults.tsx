import React from 'react';

interface AlternateCard {
  id: string;
  name: string;
  mana_cost: string;
  cmc: number;
  type_line: string;
  oracle_text: string;
  power?: string;
  toughness?: string;
  image_uris?: {
    small: string;
    normal: string;
  };
  set_name: string;
  set: string;
  rarity: string;
  colors: string[];
  color_identity: string[];
}

interface AlternateResultsProps {
  results: AlternateCard[];
  onSubstitute: (selectedCard: AlternateCard) => void;
  onClose: () => void;
}

const AlternateResults: React.FC<AlternateResultsProps> = ({
  results,
  onSubstitute,
  onClose
}) => {
  if (results.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h4>Search Results</h4>
          <button onClick={onClose} style={styles.closeButton}>×</button>
        </div>
        <div style={styles.noResults}>
          No alternative cards found. Try adjusting your search criteria.
        </div>
      </div>
    );
  }

  const formatManaCost = (manaCost: string) => {
    if (!manaCost) return '';
    // Simple mana cost formatting - could be enhanced with mana symbols
    return manaCost.replace(/[{}]/g, '');
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity.toLowerCase()) {
      case 'common': return '#1e1e1e';
      case 'uncommon': return '#c0c0c0';
      case 'rare': return '#ffb000';
      case 'mythic': return '#ff8c00';
      default: return '#666';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4>Alternative Cards ({results.length} found)</h4>
        <button onClick={onClose} style={styles.closeButton}>×</button>
      </div>

      <div style={styles.resultsList}>
        {results.map((card) => (
          <div key={card.id} style={styles.cardResult}>
            <div style={styles.cardInfo}>
              <div style={styles.cardHeader}>
                <h5 style={styles.cardName}>{card.name}</h5>
                <div style={styles.manaCost}>{formatManaCost(card.mana_cost)}</div>
              </div>

              <div style={styles.cardDetails}>
                <div style={styles.typeLine}>{card.type_line}</div>
                {card.power && card.toughness && (
                  <div style={styles.powerToughness}>
                    {card.power}/{card.toughness}
                  </div>
                )}
              </div>

              <div style={styles.setInfo}>
                <span style={styles.setName}>{card.set_name} ({card.set.toUpperCase()})</span>
                <span
                  style={{
                    ...styles.rarity,
                    color: getRarityColor(card.rarity)
                  }}
                >
                  {card.rarity.charAt(0).toUpperCase() + card.rarity.slice(1)}
                </span>
              </div>

              <div style={styles.oracleText}>
                {card.oracle_text}
              </div>
            </div>

            {card.image_uris && (
              <div style={styles.cardImage}>
                <img
                  src={card.image_uris.small}
                  alt={card.name}
                  style={styles.image}
                />
              </div>
            )}

            <div style={styles.cardActions}>
              <button
                onClick={() => onSubstitute(card)}
                style={styles.substituteButton}
              >
                Use This Card
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    margin: '20px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    maxHeight: '600px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px 20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#6c757d',
  },
  noResults: {
    padding: '40px 20px',
    textAlign: 'center' as const,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  resultsList: {
    padding: '20px',
    overflowY: 'auto' as const,
    flex: 1,
  },
  cardResult: {
    display: 'flex',
    gap: '15px',
    padding: '15px',
    border: '1px solid #e9ecef',
    borderRadius: '6px',
    marginBottom: '15px',
    backgroundColor: '#fafafa',
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px',
  },
  cardName: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  manaCost: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#666',
    backgroundColor: '#e9ecef',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  cardDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  typeLine: {
    fontSize: '13px',
    color: '#666',
    fontWeight: 'bold',
  },
  powerToughness: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#333',
    backgroundColor: '#e9ecef',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  setInfo: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  setName: {
    fontSize: '12px',
    color: '#666',
  },
  rarity: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
  oracleText: {
    fontSize: '13px',
    lineHeight: '1.4',
    color: '#444',
    backgroundColor: 'white',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #e9ecef',
  },
  cardImage: {
    flexShrink: 0,
  },
  image: {
    width: '120px',
    height: 'auto',
    borderRadius: '4px',
    border: '1px solid #ddd',
  },
  cardActions: {
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: '100px',
  },
  substituteButton: {
    padding: '8px 16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap' as const,
  },
};

export default AlternateResults;