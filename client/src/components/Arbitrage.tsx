import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArbitrageScan, ArbitrageOpportunity } from '../types/arbitrage';
import { arbitrageService } from '../services';
import { getVendorDisplayName } from '../constants/vendors';

type SortKey = 'name' | 'set' | 'buyVendor' | 'buyCashCents' | 'sellVendor' | 'sellPriceCents' | 'marginCents' | 'marginPct';
type SortDir = 'asc' | 'desc';

const POLL_INTERVAL_MS = 5000;

const COLUMNS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: 'name', label: 'Card' },
  { key: 'set', label: 'Set' },
  { key: 'buyVendor', label: 'Buyer' },
  { key: 'buyCashCents', label: 'Buy Price', numeric: true },
  { key: 'sellVendor', label: 'Seller' },
  { key: 'sellPriceCents', label: 'Sell Price', numeric: true },
  { key: 'marginCents', label: 'Margin', numeric: true },
  { key: 'marginPct', label: 'Margin %', numeric: true }
];

const formatPrice = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

const isActive = (scan: ArbitrageScan | null): boolean =>
  scan?.status === 'queued' || scan?.status === 'running';

const sortOpportunities = (opportunities: ArbitrageOpportunity[], key: SortKey, dir: SortDir): ArbitrageOpportunity[] => {
  const sorted = [...opportunities].sort((a, b) => {
    const left = a[key] ?? '';
    const right = b[key] ?? '';
    return typeof left === 'number' && typeof right === 'number'
      ? left - right
      : String(left).localeCompare(String(right));
  });
  return dir === 'asc' ? sorted : sorted.reverse();
};

const describeScan = (scan: ArbitrageScan | null): string => {
  if (!scan) return 'No scans yet';
  if (scan.status === 'queued') return 'Scan queued, waiting for the worker...';
  if (scan.status === 'running') {
    return scan.progress.total > 0
      ? `Scanning: ${scan.progress.processed} of ${scan.progress.total} cards checked`
      : 'Scanning: reading buylists...';
  }
  if (scan.status === 'failed') return `Last scan failed: ${scan.error || 'unknown error'}`;
  const finished = scan.finishedAt ? new Date(scan.finishedAt).toLocaleString() : '';
  return `Last scan ${finished}: ${scan.counts.buylistEntries} buylist entries over ${formatPrice(scan.minBuyPriceCents)}, ${scan.counts.cardNames} cards checked`;
};

const Arbitrage: React.FC = () => {
  const [scan, setScan] = useState<ArbitrageScan | null>(null);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [minBuyPrice, setMinBuyPrice] = useState<string>('10');
  const [maxCards, setMaxCards] = useState<string>('200');
  const [hideReview, setHideReview] = useState<boolean>(false);
  const [sortKey, setSortKey] = useState<SortKey>('marginCents');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const refresh = useCallback(async () => {
    try {
      const [latestScan, latestOpportunities] = await Promise.all([
        arbitrageService.getLatestScan(),
        arbitrageService.getOpportunities()
      ]);
      setScan(latestScan);
      setOpportunities(latestOpportunities);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load arbitrage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll while a scan is in progress
  useEffect(() => {
    if (!isActive(scan)) return;
    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [scan, refresh]);

  const handleRunScan = async () => {
    try {
      setError(null);
      const started = await arbitrageService.startScan({
        minBuyPrice: parseFloat(minBuyPrice) || 10,
        maxCards: parseInt(maxCards) || undefined
      });
      setScan(started);
      setOpportunities([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
      refresh();
    }
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(COLUMNS.find(column => column.key === key)?.numeric ? 'desc' : 'asc');
    }
  };

  if (loading) {
    return <div style={styles.container}>Loading arbitrage data...</div>;
  }

  const scanning = isActive(scan);
  const visible = sortOpportunities(
    hideReview ? opportunities.filter(opportunity => !opportunity.needsReview) : opportunities,
    sortKey,
    sortDir
  );
  const progressPct = scan && scan.progress.total > 0
    ? Math.round((scan.progress.processed / scan.progress.total) * 100)
    : 0;

  return (
    <div style={styles.container}>
      <Link to="/" style={styles.backLink}>← Back to Decks</Link>

      <div style={styles.header}>
        <h1>Buylist Arbitrage</h1>
        <div style={styles.controls}>
          <label style={styles.label}>
            Min buy price $
            <input
              type="number"
              min="1"
              value={minBuyPrice}
              onChange={(e) => setMinBuyPrice(e.target.value)}
              style={styles.input}
              disabled={scanning}
            />
          </label>
          <label style={styles.label} title="Checks the highest buy prices first. Leave blank for no limit.">
            Max cards
            <input
              type="number"
              min="1"
              value={maxCards}
              onChange={(e) => setMaxCards(e.target.value)}
              style={styles.input}
              disabled={scanning}
            />
          </label>
          <button
            onClick={handleRunScan}
            disabled={scanning}
            style={{ ...styles.scanButton, ...(scanning ? styles.scanButtonDisabled : {}) }}
          >
            {scanning ? 'Scanning...' : 'Run Scan'}
          </button>
        </div>
      </div>

      {error && <div style={styles.error}>Error: {error}</div>}

      <div style={styles.status}>
        {describeScan(scan)}
        {scanning && (
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${progressPct}%` }} />
          </div>
        )}
      </div>

      <div style={styles.note}>
        Near Mint, in stock listings priced below what Face To Face or Taps pay in cash.
        Margins exclude shipping, tax and grading risk.
      </div>

      <div style={styles.tableHeader}>
        <span>{visible.length} opportunities</span>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={hideReview}
            onChange={(e) => setHideReview(e.target.checked)}
          />
          Hide uncertain matches
        </label>
      </div>

      {visible.length === 0 ? (
        <div style={styles.empty}>
          {scanning ? 'No opportunities found yet' : 'No opportunities found'}
        </div>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                {COLUMNS.map(column => (
                  <th
                    key={column.key}
                    onClick={() => handleSort(column.key)}
                    style={{ ...styles.th, ...(column.numeric ? styles.numeric : {}) }}
                  >
                    {column.label}{sortKey === column.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(opportunity => (
                <tr key={opportunity._id} style={styles.row}>
                  <td style={styles.td}>
                    <div style={styles.cardName}>{opportunity.name}</div>
                    <div style={styles.details}>
                      {[
                        opportunity.finish,
                        opportunity.treatment,
                        opportunity.collectorNumber ? `#${opportunity.collectorNumber}` : null
                      ].filter(Boolean).join(' · ')}
                    </div>
                    {opportunity.needsReview && (
                      <span style={styles.reviewBadge} title="Printing could not be confirmed. Check both listings before buying.">
                        Check printing
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>{opportunity.set}</td>
                  <td style={styles.td}>
                    {opportunity.buyUrl ? (
                      <a href={opportunity.buyUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                        {getVendorDisplayName(opportunity.buyVendor)}
                      </a>
                    ) : getVendorDisplayName(opportunity.buyVendor)}
                  </td>
                  <td style={{ ...styles.td, ...styles.numeric }}>
                    {formatPrice(opportunity.buyCashCents)}
                    {opportunity.buyCreditCents ? (
                      <div style={styles.details}>{formatPrice(opportunity.buyCreditCents)} credit</div>
                    ) : null}
                  </td>
                  <td style={styles.td}>
                    {opportunity.sellUrl ? (
                      <a href={opportunity.sellUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                        {getVendorDisplayName(opportunity.sellVendor)}
                      </a>
                    ) : getVendorDisplayName(opportunity.sellVendor)}
                    <div style={styles.details}>{opportunity.sellCondition}</div>
                  </td>
                  <td style={{ ...styles.td, ...styles.numeric }}>{formatPrice(opportunity.sellPriceCents)}</td>
                  <td style={{ ...styles.td, ...styles.numeric, ...styles.margin }}>{formatPrice(opportunity.marginCents)}</td>
                  <td style={{ ...styles.td, ...styles.numeric }}>{opportunity.marginPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
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
  backLink: {
    color: '#007bff',
    textDecoration: 'none',
    fontSize: '14px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '15px',
    marginBottom: '20px',
  },
  controls: {
    display: 'flex',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
    gap: '12px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column' as const,
    fontSize: '12px',
    color: '#6c757d',
    gap: '4px',
  },
  input: {
    width: '90px',
    padding: '8px',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    fontSize: '14px',
  },
  scanButton: {
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  scanButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
  },
  error: {
    color: '#dc3545',
    marginBottom: '20px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
  },
  status: {
    padding: '12px 15px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '8px',
    fontSize: '14px',
    marginBottom: '10px',
  },
  progressTrack: {
    height: '6px',
    backgroundColor: '#e9ecef',
    borderRadius: '3px',
    marginTop: '10px',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007bff',
    transition: 'width 0.3s',
  },
  note: {
    fontSize: '12px',
    color: '#6c757d',
    marginBottom: '20px',
  },
  tableHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontWeight: 'normal',
    cursor: 'pointer',
  },
  empty: {
    textAlign: 'center' as const,
    color: '#6c757d',
    fontSize: '18px',
    marginTop: '50px',
  },
  tableWrapper: {
    overflowX: 'auto' as const,
    backgroundColor: 'white',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '14px',
  },
  th: {
    textAlign: 'left' as const,
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderBottom: '2px solid #dee2e6',
    cursor: 'pointer',
    userSelect: 'none' as const,
    whiteSpace: 'nowrap' as const,
  },
  row: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '10px 12px',
    verticalAlign: 'top' as const,
  },
  numeric: {
    textAlign: 'right' as const,
    whiteSpace: 'nowrap' as const,
  },
  cardName: {
    fontWeight: 'bold',
  },
  details: {
    fontSize: '12px',
    color: '#6c757d',
  },
  reviewBadge: {
    display: 'inline-block',
    marginTop: '4px',
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
    backgroundColor: '#fff3cd',
    color: '#856404',
    border: '1px solid #ffeaa7',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
  },
  margin: {
    color: '#28a745',
    fontWeight: 'bold',
  },
};

export default Arbitrage;
