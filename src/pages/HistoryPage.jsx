import React, { useEffect, useMemo, useState } from 'react';
import { getTransactions } from '../services/portfolioService.js';
import { formatDateTime, formatQuantity, formatUSD } from '../utils/formatters.js';

export default function HistoryPage() {
  const [transactions, setTransactions] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [side, setSide] = useState('ALL');
  const [symbol, setSymbol] = useState('');

  useEffect(() => {
    let active = true;
    getTransactions()
      .then(rows => { if (active) setTransactions(rows || []); })
      .catch(loadError => { if (active) setError(loadError.message || 'Unable to load transaction history.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => {
    const normalizedSymbol = symbol.trim().toUpperCase();
    return transactions.filter(transaction => (side === 'ALL' || transaction.side === side)
      && (!normalizedSymbol || transaction.symbol.includes(normalizedSymbol)));
  }, [transactions, side, symbol]);

  if (busy) return <div className="loading" role="status">Loading transaction history…</div>;
  if (error) return <div className="notice" role="alert">{error} Check your Supabase configuration and database setup.</div>;

  return <>
    <p className="page-intro">A read-only record of your completed virtual trades.</p>
    <div className="table-toolbar"><div><span className="eyebrow">ACTIVITY</span><h2>All transactions</h2></div>
      <div className="history-filters">
        <label className="symbol-filter">Filter symbol<input aria-label="Filter by symbol" value={symbol} onChange={event => setSymbol(event.target.value)} placeholder="e.g. MSFT" maxLength={10} /></label>
        <div className="filter-tabs" aria-label="Filter by transaction side">{[['ALL', 'All'], ['BUY', 'Buys'], ['SELL', 'Sells']].map(([value, label]) => <button type="button" key={value} className={side === value ? 'selected' : ''} onClick={() => setSide(value)}>{label}</button>)}</div>
      </div>
    </div>
    <div className="table-scroll history-table"><table><thead><tr><th>Execution date &amp; time</th><th>Symbol</th><th>Side</th><th>Quantity</th><th>Execution price</th><th>Total amount</th><th>Realized P/L</th></tr></thead><tbody>{rows.map(transaction => {
      const realized = Number(transaction.realized_pl || 0);
      return <tr key={transaction.id}><td>{formatDateTime(transaction.executed_at)}</td><td><strong>{transaction.symbol}</strong></td><td><span className={`side-badge ${transaction.side.toLowerCase()}`}>{transaction.side}</span></td><td>{formatQuantity(transaction.quantity)}</td><td>{formatUSD(transaction.price)}</td><td>{formatUSD(transaction.total_amount)}</td><td className={realized > 0 ? 'positive' : realized < 0 ? 'negative' : ''}>{realized ? `${realized > 0 ? '+' : ''}${formatUSD(realized)}` : '—'}</td></tr>;
    })}</tbody></table>{rows.length === 0 && <div className="empty table-empty"><strong>{transactions.length ? 'No matching transactions' : 'No transactions yet'}</strong><p>{transactions.length ? 'Adjust the symbol or side filter to see other trades.' : 'Your completed virtual trades will appear here in newest first order.'}</p></div>}</div>
  </>;
}
