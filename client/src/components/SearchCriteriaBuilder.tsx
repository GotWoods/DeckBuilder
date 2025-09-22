import React, { useState, useEffect } from 'react';

interface CardAnalysis {
  name: string;
  manaCost: string;
  cmc: number;
  colorIdentity: string[];
  colors: string[];
  type: string;
  types: {
    supertypes: string[];
    cardTypes: string[];
    subtypes: string[];
  };
  power: string | null;
  toughness: string | null;
  keywords: string[];
  oracleText: string;
  abilities: {
    tapAbilities: string[];
    triggeredAbilities: string[];
    staticAbilities: string[];
    activatedAbilities: string[];
    damageAmount: number | null;
    targetTypes: string[];
  };
  rarity: string;
  setName: string;
  setCode: string;
}

interface SearchCriteria {
  cardTypes: string[];
  powerMin?: number;
  powerMax?: number;
  toughnessMin?: number;
  toughnessMax?: number;
  requiredKeywords: string[];
  oracleTextContains: string[];
  damageAmount?: number;
}

interface SearchCriteriaBuilderProps {
  cardAnalysis: CardAnalysis;
  onSearch: (criteria: SearchCriteria) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const SearchCriteriaBuilder: React.FC<SearchCriteriaBuilderProps> = ({
  cardAnalysis,
  onSearch,
  onCancel,
  isLoading = false
}) => {
  const [criteria, setCriteria] = useState<SearchCriteria>({
    cardTypes: cardAnalysis.types.cardTypes || [],
    powerMin: cardAnalysis.power ? parseInt(cardAnalysis.power) : undefined,
    powerMax: cardAnalysis.power ? parseInt(cardAnalysis.power) : undefined,
    toughnessMin: cardAnalysis.toughness ? parseInt(cardAnalysis.toughness) : undefined,
    toughnessMax: cardAnalysis.toughness ? parseInt(cardAnalysis.toughness) : undefined,
    requiredKeywords: cardAnalysis.keywords || [],
    oracleTextContains: [],
    damageAmount: cardAnalysis.abilities.damageAmount || undefined
  });

  const cardTypeOptions = ['artifact', 'creature', 'enchantment', 'instant', 'land', 'planeswalker', 'sorcery', 'tribal'];

  const handleCardTypeToggle = (cardType: string) => {
    setCriteria(prev => ({
      ...prev,
      cardTypes: prev.cardTypes.includes(cardType)
        ? prev.cardTypes.filter(t => t !== cardType)
        : [...prev.cardTypes, cardType]
    }));
  };

  const handleKeywordToggle = (keyword: string) => {
    setCriteria(prev => ({
      ...prev,
      requiredKeywords: prev.requiredKeywords.includes(keyword)
        ? prev.requiredKeywords.filter(k => k !== keyword)
        : [...prev.requiredKeywords, keyword]
    }));
  };

  const handleSearch = () => {
    onSearch(criteria);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>Find Alternatives to "{cardAnalysis.name}"</h3>
        <button onClick={onCancel} style={styles.closeButton}>×</button>
      </div>

      <div style={styles.content}>
        {/* Card Types */}
        <div style={styles.section}>
          <h4>Card Types</h4>
          <div style={styles.typeGrid}>
            {cardTypeOptions.map(type => (
              <label key={type} style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={criteria.cardTypes.includes(type)}
                  onChange={() => handleCardTypeToggle(type)}
                />
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* Power/Toughness (for creatures) */}
        {(cardAnalysis.power !== null || cardAnalysis.toughness !== null) && (
          <div style={styles.section}>
            <h4>Power / Toughness</h4>
            <div style={styles.powerToughnessGrid}>
              <div></div> {/* Empty cell for top-left */}
              <div style={styles.gridHeader}>Min</div>
              <div style={styles.gridHeader}>Max</div>

              <div style={styles.gridLabel}>Power</div>
              <input
                type="number"
                min="0"
                value={criteria.powerMin || ''}
                onChange={(e) => setCriteria(prev => ({
                  ...prev,
                  powerMin: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                style={styles.gridInput}
              />
              <input
                type="number"
                min="0"
                value={criteria.powerMax || ''}
                onChange={(e) => setCriteria(prev => ({
                  ...prev,
                  powerMax: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                style={styles.gridInput}
              />

              <div style={styles.gridLabel}>Toughness</div>
              <input
                type="number"
                min="0"
                value={criteria.toughnessMin || ''}
                onChange={(e) => setCriteria(prev => ({
                  ...prev,
                  toughnessMin: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                style={styles.gridInput}
              />
              <input
                type="number"
                min="0"
                value={criteria.toughnessMax || ''}
                onChange={(e) => setCriteria(prev => ({
                  ...prev,
                  toughnessMax: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                style={styles.gridInput}
              />
            </div>
          </div>
        )}

        {/* Keywords */}
        {cardAnalysis.keywords.length > 0 && (
          <div style={styles.section}>
            <h4>Keywords</h4>
            <div style={styles.keywordGrid}>
              {cardAnalysis.keywords.map(keyword => (
                <label key={keyword} style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={criteria.requiredKeywords.includes(keyword)}
                    onChange={() => handleKeywordToggle(keyword)}
                  />
                  {keyword.charAt(0).toUpperCase() + keyword.slice(1)}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Damage Amount */}
        {cardAnalysis.abilities.damageAmount && (
          <div style={styles.section}>
            <h4>Damage Amount</h4>
            <label>
              Must deal exactly:
              <input
                type="number"
                min="1"
                value={criteria.damageAmount || ''}
                onChange={(e) => setCriteria(prev => ({
                  ...prev,
                  damageAmount: e.target.value ? parseInt(e.target.value) : undefined
                }))}
                style={styles.numberInput}
              />
              damage (leave empty for any amount)
            </label>
          </div>
        )}
      </div>

      <div style={styles.footer}>
        <button onClick={onCancel} style={styles.cancelButton} disabled={isLoading}>
          Cancel
        </button>
        <button onClick={handleSearch} style={styles.searchButton} disabled={isLoading}>
          {isLoading ? 'Searching...' : 'Search Alternatives'}
        </button>
      </div>
    </div>
  );
};

const styles = {
  container: {
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    maxWidth: '600px',
    margin: '20px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#6c757d',
  },
  content: {
    padding: '20px',
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  section: {
    marginBottom: '20px',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '8px',
  },
  keywordGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px',
  },
  rangeInputs: {
    display: 'flex',
    gap: '20px',
    alignItems: 'center',
  },
  numberInput: {
    width: '80px',
    padding: '4px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    marginLeft: '8px',
  },
  powerToughnessGrid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr 1fr',
    gap: '8px',
    alignItems: 'center',
    maxWidth: '300px',
  },
  gridHeader: {
    fontWeight: 'bold',
    textAlign: 'center' as const,
    fontSize: '14px',
    color: '#666',
  },
  gridLabel: {
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#333',
  },
  gridInput: {
    width: '80px',
    padding: '6px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    textAlign: 'center' as const,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  searchButton: {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
};

export default SearchCriteriaBuilder;