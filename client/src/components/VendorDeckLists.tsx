import React, { useState } from 'react';
import { Deck } from '../types/deck';

interface VendorCard {
  index: number;
  name: string;
  quantity: number;
  purchased: boolean;
  price: number;
  set?: string;
  condition?: string;
}

interface VendorDeckListsProps {
  deck: Deck;
  getVendorDisplayName: (vendor: string) => string;
  onTogglePurchased: (cardIndex: number) => void;
  onCopy: (text: string) => void;
  onClose: () => void;
}

// Groups each card under the vendor its selected price came from
const groupSelectedCardsByVendor = (deck: Deck): Record<string, VendorCard[]> => {
  const groups: Record<string, VendorCard[]> = {};

  deck.Cards.forEach((card, index) => {
    if (!card.pricing?.groupedByVendor) return;

    Object.entries(card.pricing.groupedByVendor).forEach(([vendor, results]) => {
      const selected = results.find(result => result.selected);
      if (!selected) return;

      if (!groups[vendor]) groups[vendor] = [];
      groups[vendor].push({
        index,
        name: card.Name,
        quantity: card.Quantity,
        purchased: !!card.purchased,
        price: selected.price,
        set: selected.set,
        condition: selected.condition,
      });
    });
  });

  // Unpurchased first, then purchased, each alphabetical
  Object.values(groups).forEach(cards =>
    cards.sort((a, b) => Number(a.purchased) - Number(b.purchased) || a.name.localeCompare(b.name))
  );

  return groups;
};

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const VendorDeckLists: React.FC<VendorDeckListsProps> = ({
  deck,
  getVendorDisplayName,
  onTogglePurchased,
  onCopy,
  onClose,
}) => {
  const [collapsed, setCollapsed] = useState<Record<string, boolean | undefined>>({});
  const groups = groupSelectedCardsByVendor(deck);
  const vendors = Object.keys(groups).sort((a, b) => groups[b].length - groups[a].length);

  // Vendors with every card purchased collapse unless the user expands them
  const isCollapsed = (vendor: string) =>
    collapsed[vendor] ?? groups[vendor].every(card => card.purchased);

  const toggleCollapsed = (vendor: string) =>
    setCollapsed(prev => ({ ...prev, [vendor]: !isCollapsed(vendor) }));

  // Clear the manual override so the vendor re-evaluates auto-collapse
  const handleTogglePurchased = (vendor: string, cardIndex: number) => {
    setCollapsed(prev => {
      const next = { ...prev };
      delete next[vendor];
      return next;
    });
    onTogglePurchased(cardIndex);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Deck Lists</h2>
        <button onClick={onClose} style={styles.closeButton}>← Back to Cards</button>
      </div>

      {vendors.length === 0 && (
        <div style={styles.empty}>No selected cards. Select a price for a card to add it to a vendor list.</div>
      )}

      {vendors.map(vendor => {
        const cards = groups[vendor];
        const remaining = cards.filter(card => !card.purchased);
        // Deck list text only includes cards still to buy
        const listText = remaining.map(card => `${card.quantity} ${card.name}`).join('\n');
        const total = remaining.reduce((sum, card) => sum + card.price * card.quantity, 0);
        const vendorCollapsed = isCollapsed(vendor);

        return (
          <div key={vendor} style={styles.vendorSection}>
            <div style={styles.vendorHeader} onClick={() => toggleCollapsed(vendor)}>
              <span style={styles.chevron}>{vendorCollapsed ? '▶' : '▼'}</span>
              <span style={styles.vendorName}>{getVendorDisplayName(vendor)}</span>
              <span style={styles.vendorSummary}>
                {remaining.length} of {cards.length} remaining · {formatPrice(total)}
              </span>
            </div>

            {!vendorCollapsed && (
              <div style={styles.vendorBody}>
                <div style={styles.listTextContainer}>
                  <textarea
                    readOnly
                    value={listText}
                    rows={Math.min(Math.max(remaining.length, 3), 15)}
                    style={styles.listText}
                    onFocus={e => e.target.select()}
                  />
                  <button
                    onClick={() => onCopy(listText)}
                    disabled={remaining.length === 0}
                    style={styles.copyButton}
                  >
                    📋 Copy
                  </button>
                </div>

                {cards.map(card => (
                  <div key={card.index} style={card.purchased ? styles.cardRowPurchased : styles.cardRow}>
                    <span style={styles.cardQuantity}>{card.quantity}x</span>
                    <span style={styles.cardName}>{card.name}</span>
                    <span style={styles.cardDetails}>
                      {card.set || '-'}
                      {card.condition && card.condition !== 'Unknown' && ` (${card.condition})`}
                    </span>
                    <span style={styles.cardPrice}>{formatPrice(card.price)}</span>
                    <button
                      onClick={() => handleTogglePurchased(vendor, card.index)}
                      style={card.purchased ? styles.purchasedLabel : styles.purchasedButton}
                    >
                      {card.purchased ? '✓ Purchased' : '☐ Purchased'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const styles = {
  container: {
    marginTop: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    margin: 0,
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#007bff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  empty: {
    color: '#6c757d',
    padding: '20px',
    textAlign: 'center' as const,
  },
  vendorSection: {
    backgroundColor: 'white',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '10px',
  },
  vendorHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px 15px',
    cursor: 'pointer',
    userSelect: 'none' as const,
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  chevron: {
    fontSize: '12px',
    color: '#6c757d',
    width: '12px',
  },
  vendorName: {
    flex: 1,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#333',
  },
  vendorSummary: {
    fontSize: '13px',
    color: '#6c757d',
  },
  vendorBody: {
    padding: '15px',
  },
  listTextContainer: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    marginBottom: '15px',
  },
  listText: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: '13px',
    padding: '8px',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
    resize: 'vertical' as const,
  },
  copyButton: {
    padding: '6px 12px',
    backgroundColor: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
  },
  cardRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f1f3f5',
  },
  cardRowPurchased: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
    borderBottom: '1px solid #f1f3f5',
    opacity: 0.6,
  },
  cardQuantity: {
    minWidth: '30px',
    fontWeight: 'bold',
    color: '#495057',
  },
  cardName: {
    flex: 1,
    fontSize: '14px',
    color: '#333',
  },
  cardDetails: {
    fontSize: '12px',
    color: '#6c757d',
  },
  cardPrice: {
    minWidth: '50px',
    textAlign: 'right' as const,
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#495057',
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
};

export default VendorDeckLists;
