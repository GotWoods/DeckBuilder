import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Deck } from '../types/deck';
import { deckService } from '../services';
import { useSocket } from '../contexts/SocketContext';
import Toast from './Toast';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import AlternateCardsModal from './AlternateCardsModal';

interface ProgressState {
  active: boolean;
  progress: number;
}

// Vendor display name mapping
const VENDOR_DISPLAY_NAMES: Record<string, string> = {
  facetoface: 'Face To Face',
  taps: 'Taps',
  redclaw: 'Red Claw',
  prisma: 'Prisma',
  cerberus: 'Cerberus'
};

const DeckDetails: React.FC = () => {
  const { id: deckId } = useParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | undefined>();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Helper function to get vendor display name
  const getVendorDisplayName = (vendor: string): string => {
    return VENDOR_DISPLAY_NAMES[vendor.toLowerCase()] || vendor;
  };
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showOutOfStock, setShowOutOfStock] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressState>({
    active: false,
    progress: 0
  });
  const [toastVisible, setToastVisible] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [alternateModalCard, setAlternateModalCard] = useState<{ name: string; index: number } | null>(null);
  const navigate = useNavigate();
  const { joinDeckRoom, leaveDeckRoom, onProgress, offProgress } = useSocket();

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const calculateCheapestVendorStats = (deck: Deck) => {
    const vendorStats: Record<string, number> = {};

    deck.Cards.forEach(card => {
      if (!card.pricing?.groupedByVendor || card.purchased) return;

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

  // Min/max/avg across all vendors, including out of stock results
  const calculateCardPriceRange = (card: Deck['Cards'][number]) => {
    // Worker stats cover every listing; stored results are only a reduced subset
    if (card.pricing?.stats) return card.pricing.stats;

    const prices = (card.pricing?.results || [])
      .map(result => result.price)
      .filter(price => price > 0);
    if (prices.length === 0) return null;

    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((sum, price) => sum + price, 0) / prices.length,
    };
  };

  const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

  const calculateInStockVendorStats = (deck: Deck) => {
    const vendorStats: Record<string, number> = {};

    deck.Cards.forEach(card => {
      if (!card.pricing?.groupedByVendor || card.purchased) return;

      // Count which vendors have this card in stock
      Object.entries(card.pricing.groupedByVendor).forEach(([vendor, results]) => {
        const hasInStock = results.some(result => result.inStock);
        if (hasInStock) {
          vendorStats[vendor] = (vendorStats[vendor] || 0) + 1;
        }
      });
    });

    return vendorStats;
  };

  const calculateSelectedVendorStats = (deck: Deck) => {
    const vendorStats: Record<string, number> = {};

    deck.Cards.forEach(card => {
      if (!card.pricing?.groupedByVendor || card.purchased) return;

      // Count which vendors have selected pricing for this card
      Object.entries(card.pricing.groupedByVendor).forEach(([vendor, results]) => {
        const hasSelected = results.some(result => result.selected);
        if (hasSelected) {
          vendorStats[vendor] = (vendorStats[vendor] || 0) + 1;
        }
      });
    });

    return vendorStats;
  };

  const getSelectedCardsByVendor = (deck: Deck, vendor: string): string[] => {
    const selectedCards: string[] = [];

    deck.Cards.forEach(card => {
      if (!card.pricing?.groupedByVendor || card.purchased) return;

      const vendorResults = card.pricing.groupedByVendor[vendor];
      if (vendorResults) {
        const hasSelected = vendorResults.some(result => result.selected);
        if (hasSelected) {
          selectedCards.push(`1 ${card.Name}`);
        }
      }
    });

    return selectedCards;
  };

  const handleCopySelectedCards = async (vendor: string) => {
    const selectedCards = getSelectedCardsByVendor(deck!, vendor);
    const cardList = selectedCards.join('\n');

    try {
      await navigator.clipboard.writeText(cardList);
      setToastVisible(true);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
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

  // Socket.io setup for real-time progress
  useEffect(() => {
    if (!deckId) return;

    // Join deck-specific room
    joinDeckRoom(deckId);

    // Progress event handler
    const handleProgress = (event: any) => {
      console.log('Progress event received:', event);

      if (event.deckId !== deckId) return;

      switch (event.type) {
        case 'start':
          setProgress({
            active: true,
            progress: 0
          });
          break;

        case 'batch':
        case 'card':
          setProgress(prev => ({
            ...prev,
            progress: event.progress || 0
          }));
          break;

        case 'complete':
          setProgress({
            active: false,
            progress: 100
          });
          // Refresh deck data after completion
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          break;

        case 'error':
          setProgress({
            active: false,
            progress: 0
          });
          setError(event.message);
          break;
      }
    };

    // Subscribe to progress events
    onProgress(handleProgress);

    // Initialize progress state if deck is currently importing
    if (deck?.Importing) {
      setProgress({
        active: true,
        progress: 0
      });
    }

    // Cleanup on unmount
    return () => {
      offProgress(handleProgress);
      leaveDeckRoom(deckId);
    };
  }, [deckId, deck?.Importing, joinDeckRoom, leaveDeckRoom, onProgress, offProgress]);

  const handleSelectPrice = async (cardIndex: number, vendor: string, resultIndex: number) => {
    if (!deck || !deckId) return;

    const updatedDeck = { ...deck };
    const card = updatedDeck.Cards[cardIndex];

    if (!card.pricing?.groupedByVendor) return;

    // Clear all selections for this card
    Object.values(card.pricing.groupedByVendor).forEach(results => {
      results.forEach(result => {
        result.selected = false;
      });
    });

    // Set the selected option
    if (card.pricing.groupedByVendor[vendor] && card.pricing.groupedByVendor[vendor][resultIndex]) {
      card.pricing.groupedByVendor[vendor][resultIndex].selected = true;
    }

    setDeck(updatedDeck);

    // Save selection to database
    try {
      await deckService.updateSelectedPricing(deckId, cardIndex, vendor, resultIndex);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save selected pricing';
      setError(errorMessage);
    }
  };

  const handleTogglePurchased = async (cardIndex: number) => {
    if (!deckId) return;

    try {
      const result = await deckService.toggleCardPurchased(deckId, cardIndex);
      // Update the deck data to show new state
      if (deck) {
        const updatedDeck = { ...deck };
        updatedDeck.Cards[cardIndex].purchased = result.purchased;
        setDeck(updatedDeck);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle card purchase status';
      setError(errorMessage);
    }
  };

  const handleRefreshPrices = async () => {
    if (!deckId) return;

    try {
      console.log('Starting price refresh for deck:', deckId);
      await deckService.refreshDeckPricing(deckId);
      console.log('Price refresh initiated successfully');
      // Stay on the page - progress will be shown via WebSocket events
      // The deck will automatically refresh when import completes
    } catch (err) {
      console.error('Error during price refresh:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh pricing';
      setError(errorMessage);
    }
  };

  const handleDeleteDeck = async () => {
    if (!deckId) return;

    try {
      await deckService.deleteDeck(deckId);
      navigate('/');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete deck';
      setError(errorMessage);
      setDeleteModalOpen(false);
    }
  };

  const handleFindAlternates = (cardIndex: number) => {
    const card = deck?.Cards[cardIndex];
    if (!card) return;

    setAlternateModalCard({
      name: card.Name,
      index: cardIndex
    });
  };

  const handleCloseAlternatesModal = () => {
    setAlternateModalCard(null);
  };

  const handleSubstitute = async (selectedCard: any) => {
    if (!deck || !alternateModalCard) return;

    try {
      await deckService.substituteCard(deck._id, alternateModalCard.index, selectedCard);

      // Update the local deck state with the substituted card
      setDeck(prevDeck => {
        if (!prevDeck) return prevDeck;
        const updatedCards = [...prevDeck.Cards];
        updatedCards[alternateModalCard.index] = {
          ...updatedCards[alternateModalCard.index],
          Name: selectedCard.name,
          pricing: null // Clear pricing since this is a new card
        };
        return { ...prevDeck, Cards: updatedCards };
      });

      // Close the modal
      handleCloseAlternatesModal();

      // Show success toast
      setToastVisible(true);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to substitute card';
      setError(errorMessage);
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
    <>
      <Toast
        message="Copied to clipboard"
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        deckName={deck?.name || ''}
        onConfirm={handleDeleteDeck}
        onCancel={() => setDeleteModalOpen(false)}
      />
      <div style={styles.container}>
      <div style={styles.header}>
        <Link to="/" style={isMobile ? styles.backButtonMobile : styles.backButton}>
          {isMobile ? '←' : '← Back to Decks'}
        </Link>
        <h1>{deck.name}</h1>
        {progress.active ? (
          <div style={styles.progressContainer}>
            <div style={styles.progressText}>Updating Prices</div>
            <div style={styles.progressBar}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${progress.progress}%`
                }}
              />
            </div>
          </div>
        ) : deck.Importing ? (
          <span style={{
            ...styles.status,
            ...styles.statusImporting
          }}>
            Importing...
          </span>
        ) : null}
        <div style={styles.buttonGroup}>
          <button
            onClick={handleRefreshPrices}
            disabled={progress.active || deck.Importing}
            style={{
              ...styles.refreshButton,
              ...(progress.active || deck.Importing ? styles.refreshButtonDisabled : {})
            }}
            title={progress.active || deck.Importing ? 'Processing...' : 'Refresh Prices'}
          >
            🔄
          </button>
          <button
            onClick={() => setDeleteModalOpen(true)}
            disabled={progress.active || deck.Importing}
            style={{
              ...styles.deleteButton,
              ...(progress.active || deck.Importing ? styles.deleteButtonDisabled : {})
            }}
            title="Delete Deck"
          >
            🗑️
          </button>
        </div>
      </div>

      <div style={isMobile ? styles.deckInfo : styles.deckInfoDesktop}>
        <div style={styles.deckInfoLeft}>
          <p><strong>Total Cards:</strong> {deck.Cards.reduce((total, card) => total + card.Quantity, 0)}</p>
          <p><strong>Created:</strong> {new Date(deck.createdAt).toLocaleDateString()}</p>
        </div>
        {!deck.Importing && (
          <div style={isMobile ? styles.vendorSummary : styles.vendorSummaryDesktop}>
            <div style={isMobile ? styles.vendorSummaryContainer : styles.vendorSummaryContainerDesktop}>
              <div style={styles.vendorColumn}>
                <div style={styles.vendorColumnTitle}>In Stock:</div>
                <div style={styles.vendorStats}>
                  {Object.entries(calculateInStockVendorStats(deck))
                    .sort(([,a], [,b]) => b - a) // Sort by count descending
                    .map(([vendor, count]) => (
                      <div key={vendor} style={styles.vendorStat}>
                        <span style={styles.vendorName}>{getVendorDisplayName(vendor)}</span>
                        <span style={styles.vendorCount}>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div style={styles.vendorColumn}>
                <div style={styles.vendorColumnTitle}>Cheapest:</div>
                <div style={styles.vendorStats}>
                  {Object.entries(calculateCheapestVendorStats(deck))
                    .sort(([,a], [,b]) => b - a) // Sort by count descending
                    .map(([vendor, count]) => (
                      <div key={vendor} style={styles.vendorStat}>
                        <span style={styles.vendorName}>{getVendorDisplayName(vendor)}</span>
                        <span style={styles.vendorCount}>{count}</span>
                      </div>
                    ))}
                </div>
              </div>
              <div style={styles.vendorColumn}>
                <div style={styles.vendorColumnTitle}>Selected:</div>
                <div style={styles.vendorStats}>
                  {Object.entries(calculateSelectedVendorStats(deck))
                    .sort(([,a], [,b]) => b - a) // Sort by count descending
                    .map(([vendor, count]) => (
                      <div key={vendor} style={styles.vendorStatWithCopy}>
                        <div style={styles.vendorStat}>
                          <span style={styles.vendorName}>{getVendorDisplayName(vendor)}</span>
                          <span style={styles.vendorCount}>{count}</span>
                        </div>
                        {count > 0 && (
                          <button
                            onClick={() => handleCopySelectedCards(vendor)}
                            style={styles.copyButton}
                            title={`Copy selected cards from ${getVendorDisplayName(vendor)}`}
                          >
                            📋
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              </div>
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
              {!card.purchased && (() => {
                const range = calculateCardPriceRange(card);
                if (!range) return null;
                return (
                  <div style={styles.priceRange} title="Across all vendors, including out of stock">
                    <span>Min <strong>{formatPrice(range.min)}</strong></span>
                    <span>Avg <strong>{formatPrice(range.avg)}</strong></span>
                    <span>Max <strong>{formatPrice(range.max)}</strong></span>
                  </div>
                );
              })()}
              {!progress.active && (
                <div style={styles.cardActions}>
                  {card.purchased ? (
                    <button
                      onClick={() => handleTogglePurchased(index)}
                      style={styles.purchasedLabel}
                    >
                      ✓ Purchased
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTogglePurchased(index)}
                      style={styles.purchasedButton}
                    >
                      ☐ Purchased
                    </button>
                  )}
                </div>
              )}
            </div>
            
            {!card.purchased && card.pricing?.groupedByVendor && (() => {
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

              // Find the cheapest in-stock price across all vendors
              let cheapestPrice = Infinity;
              Object.values(filteredGroupedByVendor).forEach(results => {
                const inStockResults = results.filter(result => result.inStock);
                if (inStockResults.length > 0) {
                  const vendorCheapestPrice = inStockResults[0].price; // Already sorted by price
                  if (vendorCheapestPrice < cheapestPrice) {
                    cheapestPrice = vendorCheapestPrice;
                  }
                }
              });

              return (
                <div style={styles.cardPricing}>
                  {Object.entries(filteredGroupedByVendor).map(([vendor, results]) => (
                    results.map((result, displayIndex) => {
                      // Find the original index in the unfiltered array
                      const originalIndex = card.pricing.groupedByVendor[vendor].findIndex(r => r === result);
                      const isCheapest = result.inStock && result.price === cheapestPrice;
                      return (
                        <div key={`${vendor}-${originalIndex}`} style={styles.priceRow}>
                          <div style={styles.vendorColumn}>
                            {displayIndex === 0 ? getVendorDisplayName(vendor) : ''}
                          </div>
                          <button
                            onClick={() => handleSelectPrice(index, vendor, originalIndex)}
                            style={result.selected ? styles.checkmarkSelected : styles.checkmark}
                          >
                            {result.selected ? '✓' : ''}
                          </button>
                          <span style={isCheapest ? styles.priceValueCheapest : styles.priceValue}>
                            ${(result.price / 100).toFixed(2)}
                            {!result.inStock && <span style={styles.outOfStock}> (OOS)</span>}
                          </span>
                          <span style={styles.priceSet}>
                            {result.set || '-'}
                            {result.condition && result.condition !== 'Unknown' && ` (${result.condition})`}
                          </span>
                        </div>
                      );
                    })
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

    {/* Alternate Cards Modal */}
    {alternateModalCard && deck && (
      <AlternateCardsModal
        cardName={alternateModalCard.name}
        deckColorIdentity={deck.colorIdentity || []}
        excludeCards={deck.Cards.map(card => card.Name.toLowerCase())}
        onSubstitute={handleSubstitute}
        onClose={handleCloseAlternatesModal}
      />
    )}
    </>
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
  backButtonMobile: {
    textDecoration: 'none',
    color: '#007bff',
    fontSize: '20px',
    fontWeight: 'bold',
    padding: '10px',
    borderRadius: '6px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
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
    flexDirection: 'column' as const,
    marginBottom: '30px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '14px',
    gap: '15px',
  },
  deckInfoDesktop: {
    display: 'flex',
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '30px',
    padding: '20px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '16px',
    gap: '0',
  },
  deckInfoLeft: {
    flex: 1,
  },
  vendorSummary: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'stretch',
    width: '100%',
  },
  vendorSummaryDesktop: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    minWidth: '500px',
  },
  vendorSummaryContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  vendorSummaryContainerDesktop: {
    display: 'flex',
    flexDirection: 'row' as const,
    gap: '15px',
  },
  vendorColumn: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    flex: 1,
    minWidth: '120px',
  },
  vendorColumnTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
    marginBottom: '8px',
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
  vendorStatWithCopy: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  copyButton: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '2px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.7,
    transition: 'opacity 0.2s, background-color 0.2s',
    ':hover': {
      opacity: 1,
      backgroundColor: '#f8f9fa',
    }
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
  priceRange: {
    display: 'flex',
    gap: '10px',
    fontSize: '12px',
    color: '#6c757d',
    marginLeft: '15px',
    whiteSpace: 'nowrap' as const,
  },
  cardActions: {
    marginLeft: '15px',
    display: 'flex',
    gap: '10px',
  },
  purchasedButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '6px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  purchasedLabel: {
    color: '#28a745',
    fontSize: '12px',
    fontWeight: 'bold',
    padding: '6px 12px',
    backgroundColor: '#d4edda',
    borderRadius: '4px',
    border: '1px solid #c3e6cb',
    cursor: 'pointer',
  },
  cardPricing: {
    display: 'flex',
    flexDirection: 'column' as const,
    marginTop: '8px',
  },
  priceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '4px',
    paddingLeft: '12px',
  },
  vendorColumn: {
    minWidth: '100px',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
    textAlign: 'left' as const,
  },
  checkmark: {
    backgroundColor: 'transparent',
    border: '1px solid #dee2e6',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#6c757d',
  },
  checkmarkSelected: {
    backgroundColor: '#28a745',
    border: '1px solid #28a745',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
  },
  priceVendor: {
    fontSize: '12px',
    color: '#6c757d',
  },
  priceValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#6c757d',
  },
  priceValueCheapest: {
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
  progressContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    minWidth: '300px',
  },
  progressText: {
    fontSize: '14px',
    color: '#495057',
    marginBottom: '8px',
    fontWeight: 'bold' as const,
  },
  progressBar: {
    width: '100%',
    height: '8px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.3s ease',
    borderRadius: '4px',
  },
  refreshButton: {
    padding: '10px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
  },
  refreshButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
  },
  deleteButton: {
    padding: '10px',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
  },
  deleteButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
    opacity: 0.6,
  },
  alternatesButton: {
    padding: '6px 12px',
    backgroundColor: '#6f42c1',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
};

export default DeckDetails;