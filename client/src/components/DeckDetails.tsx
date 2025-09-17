import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Deck } from '../types/deck';
import { deckService } from '../services';

const DeckDetails: React.FC = () => {
  const { id: deckId } = useParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | undefined>();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOutOfStock, setShowOutOfStock] = useState<boolean>(false);
  const navigate = useNavigate();

  const calculateCheapestVendorStats = (deck: Deck) => {
    const vendorStats: Record<string, number> = {};

    deck.Cards.forEach(card => {
      if (!card.pricing?.groupedByVendor) return;

      let cheapestPrice = Infinity;
      let cheapestVendor = '';

      // Find the cheapest in-stock price across all vendors
      Object.entries(card.pricing.groupedByVendor).forEach(([vendor, results]) => {
        const inStockResults = results.filter(result => result.inStock);
        if (inStockResults.length > 0) {
          const vendorCheapestPrice = inStockResults[0].price; // Already sorted by price
          if (vendorCheapestPrice < cheapestPrice) {
            cheapestPrice = vendorCheapestPrice;
            cheapestVendor = vendor;
          }
        }
      });

      // Increment count for the cheapest vendor
      if (cheapestVendor) {
        vendorStats[cheapestVendor] = (vendorStats[cheapestVendor] || 0) + 1;
      }
    });

    return vendorStats;
  };

  useEffect(() => {

  const processCardPricing = (deck: Deck): Deck => {
    return {
      ...deck,
      Cards: deck.Cards.map(card => {
        if (!card.pricing?.results) return card;

        // Group results by vendor/source
        const groupedByVendor = card.pricing.results.reduce((groups, result) => {
          if (!groups[result.source]) {
            groups[result.source] = [];
          }
          groups[result.source].push(result);
          return groups;
        }, {} as Record<string, typeof card.pricing.results>);

        // Sort each vendor's results by price (lowest to highest)
        Object.keys(groupedByVendor).forEach(vendor => {
          groupedByVendor[vendor].sort((a, b) => a.price - b.price);
        });

        return {
          ...card,
          pricing: {
            ...card.pricing,
            groupedByVendor
          }
        };
      })
    };
  };

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
        const processedData = processCardPricing(data);
        setDeck(processedData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deck';
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchDeck();
  }, [deckId]);

  const handleRefreshPrices = async () => {
    if (!deckId) return;

    try {
      console.log('Starting price refresh for deck:', deckId);
      await deckService.refreshDeckPricing(deckId);
      console.log('Price refresh completed, navigating to home');
      navigate('/');
    } catch (err) {
      console.error('Error during price refresh:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh pricing';
      setError(errorMessage);
      // Still navigate even if there's an error, since the refresh might have been initiated
      navigate('/');
    }
  };

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
        <button onClick={handleRefreshPrices} >Refresh Prices</button>
      </div>

      <div style={styles.deckInfo}>
        <div style={styles.deckInfoLeft}>
          <p><strong>Total Cards:</strong> {deck.Cards.length}</p>
          <p><strong>Created:</strong> {new Date(deck.createdAt).toLocaleDateString()}</p>
        </div>
        {!deck.Importing && (
          <div style={styles.vendorSummary}>
            <div style={styles.vendorSummaryTitle}>Cheapest In-Stock Vendor:</div>
            <div style={styles.vendorStats}>
              {Object.entries(calculateCheapestVendorStats(deck))
                .sort(([,a], [,b]) => b - a) // Sort by count descending
                .map(([vendor, count]) => (
                  <div key={vendor} style={styles.vendorStat}>
                    <span style={styles.vendorName}>{vendor}</span>
                    <span style={styles.vendorCount}>{count}</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <div style={styles.cardList}>
        <div style={styles.cardListHeader}>
          <h2>Cards</h2>
          <div style={styles.toggleContainer}>
            <label style={styles.toggleLabel}>
              <div
                style={{
                  ...styles.toggleSlider,
                  backgroundColor: showOutOfStock ? '#007bff' : '#ccc',
                }}
                onClick={() => setShowOutOfStock(!showOutOfStock)}
              >
                <div
                  style={{
                    ...styles.toggleCircle,
                    transform: showOutOfStock ? 'translateX(20px)' : 'translateX(0px)',
                  }}
                />
              </div>
              <input
                type="checkbox"
                checked={showOutOfStock}
                onChange={(e) => setShowOutOfStock(e.target.checked)}
                style={styles.toggleInput}
              />
              Show Out Of Stock Items
            </label>
          </div>
        </div>
        {deck.Cards.map((card, index) => (
          <div key={index} style={styles.cardItem}>
            <div style={styles.cardHeader}>
              <div style={styles.cardQuantity}>{card.Quantity}x</div>
              <div style={styles.cardName}>{card.Name}</div>
            </div>
            
            {card.pricing?.groupedByVendor && (() => {
              // Filter results based on showOutOfStock toggle
              const filteredGroupedByVendor = Object.entries(card.pricing.groupedByVendor).reduce((acc, [vendor, results]) => {
                const filteredResults = showOutOfStock
                  ? results
                  : results.filter(result => result.inStock);

                if (filteredResults.length > 0) {
                  acc[vendor] = filteredResults;
                }
                return acc;
              }, {} as Record<string, typeof card.pricing.groupedByVendor[string]>);

              if (Object.keys(filteredGroupedByVendor).length === 0) return null;

              return (
                <div style={styles.cardPricing}>
                  {Object.entries(filteredGroupedByVendor).map(([vendor, results]) => (
                    <div key={vendor} style={styles.vendorGroup}>
                      <div style={styles.vendorHeader}>{vendor}</div>
                      {results.map((result, resultIndex) => (
                        <div key={resultIndex} style={styles.priceItem}>
                          <span style={styles.priceValue}>
                            ${(result.price / 100).toFixed(2)}
                            {!result.inStock && <span style={styles.outOfStock}> (OOS)</span>}
                          </span>
                          <span style={styles.priceSet}>{result.set || '-'}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={styles.priceTimestamp}>
                    Updated: {new Date(card.pricing.processedAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })()}
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '16px',
  },
  deckInfoLeft: {
    flex: 1,
  },
  vendorSummary: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    minWidth: '250px',
  },
  vendorSummaryTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: '8px',
  },
  vendorStats: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  vendorStat: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    minWidth: '150px',
    padding: '4px 8px',
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
  },
  vendorName: {
    fontSize: '13px',
    color: '#495057',
    textTransform: 'capitalize' as const,
  },
  vendorCount: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#007bff',
    backgroundColor: '#e7f3ff',
    padding: '2px 6px',
    borderRadius: '12px',
    minWidth: '20px',
    textAlign: 'center' as const,
  },
  cardList: {
    marginTop: '20px',
  },
  cardListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  toggleContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#495057',
    position: 'relative' as const,
  },
  toggleInput: {
    position: 'absolute' as const,
    opacity: 0,
    width: 0,
    height: 0,
  },
  toggleSlider: {
    position: 'relative' as const,
    display: 'inline-block',
    width: '44px',
    height: '24px',
    borderRadius: '24px',
    marginRight: '8px',
    transition: 'background-color 0.3s',
    cursor: 'pointer',
  },
  toggleCircle: {
    position: 'absolute' as const,
    top: '2px',
    left: '2px',
    width: '20px',
    height: '20px',
    backgroundColor: 'white',
    borderRadius: '50%',
    transition: 'transform 0.3s',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  cardItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: '15px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: 'white',
    marginBottom: '5px',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '10px',
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
    marginTop: '8px',
  },
  vendorGroup: {
    marginBottom: '12px',
  },
  vendorHeader: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: '6px',
    paddingBottom: '4px',
    borderBottom: '1px solid #e0e0e0',
  },
  priceItem: {
    display: 'grid',
    gridTemplateColumns: '120px 1fr',
    gap: '12px',
    marginBottom: '4px',
    alignItems: 'center',
    paddingLeft: '12px',
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
  outOfStock: {
    fontSize: '12px',
    color: '#dc3545',
    fontWeight: 'normal',
  },
  priceSet: {
    fontSize: '12px',
    color: '#6c757d',
  },
  priceTimestamp: {
    fontSize: '11px',
    color: '#6c757d',
    marginTop: '8px',
    fontStyle: 'italic',
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