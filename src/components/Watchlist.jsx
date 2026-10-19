import React, { useEffect, useState } from 'react';
import { addWatchlistSymbol, getStockPrice, getWatchlist, removeWatchlistSymbol } from '../services/stockPriceService.js';

const money = value => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function Watchlist({ onSelect, refreshKey = 0 }) {
  const [items, setItems] = useState([]); const [quotes, setQuotes] = useState({}); const [symbol, setSymbol] = useState('');
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function load() { setLoading(true); setError(''); try { const rows = await getWatchlist(); setItems(rows); } catch (e) { setError(e.message || 'Unable to load your watchlist.'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, [refreshKey]);
  useEffect(() => {
    let active = true;
    items.forEach(async item => { try { const quote = await getStockPrice(item.symbol); if (active) setQuotes(current => ({ ...current, [item.symbol]: { quote } })); }
      catch (e) { if (active) setQuotes(current => ({ ...current, [item.symbol]: { error: e.message || 'Quote unavailable' } })); } });
    return () => { active = false; };
  }, [items]);
  async function add(e) { e.preventDefault(); setBusy(true); setError(''); try { await addWatchlistSymbol(symbol); setSymbol(''); await load(); } catch (e) { setError(e.message || 'Unable to add symbol.'); } finally { setBusy(false); } }
  async function remove(e, id) { e.stopPropagation(); setError(''); try { await removeWatchlistSymbol(id); setItems(rows => rows.filter(row => row.id !== id)); } catch (e) { setError(e.message || 'Unable to remove symbol.'); } }
  return <section className="watchlist-card">
    <div className="section-head watchlist-head"><div><span className="eyebrow">YOUR SYMBOLS</span><h2>Watchlist</h2></div><span className="count">{items.length} tracked</span></div>
    <form className="watchlist-add" onSubmit={add}><input aria-label="Stock symbol" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} maxLength={10} placeholder="Add symbol, e.g. MSFT" /><button className="primary" disabled={busy || !symbol.trim()}>{busy ? 'Adding…' : 'Add symbol'}</button></form>
    {error && <div className="notice">{error}</div>}
    {loading ? <div className="chart-state">Loading watchlist…</div> : !items.length ? <div className="chart-state">Your watchlist is empty. Add a symbol to track it here.</div> :
      <div className="watch-items">{items.map(item => { const status = quotes[item.symbol]; const quote = status?.quote; return <button className="watch-item" key={item.id} onClick={() => onSelect(item.symbol)}>
        <span className="watch-symbol">{item.symbol}</span><span className="watch-quote">{quote ? <><strong>{money(quote.price)}</strong>{quote.stale && <small className="stale">Stale quote</small>}</> : <small>{status?.error || 'Loading quote…'}</small>}</span>
        <span className="watch-choose">View</span><span className="watch-remove" role="button" tabIndex={0} aria-label={`Remove ${item.symbol}`} onClick={e => remove(e, item.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') remove(e, item.id); }}>×</span>
      </button>; })}</div>}
  </section>;
}
