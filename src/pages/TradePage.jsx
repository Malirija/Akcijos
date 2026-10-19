import React, { useEffect, useState } from 'react';
import { getProfile } from '../services/portfolioService.js';
import { getStockPrice } from '../services/stockPriceService.js';
import { executeTrade } from '../services/tradeService.js';
import PriceChart from '../components/PriceChart.jsx';
import Watchlist from '../components/Watchlist.jsx';

const currency = value => Number(value).toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function TradePage({ onTradeSuccess }) {
  const [symbol, setSymbol] = useState(''); const [quantity, setQuantity] = useState(''); const [side, setSide] = useState('BUY');
  const [quote, setQuote] = useState(null); const [quoteBusy, setQuoteBusy] = useState(false); const [tradeBusy, setTradeBusy] = useState(false);
  const [error, setError] = useState(''); const [success, setSuccess] = useState(null); const [profile, setProfile] = useState(null); const [watchRefresh, setWatchRefresh] = useState(0);
  useEffect(() => { getProfile().then(setProfile).catch(() => {}); }, []);
  async function loadQuote(forSymbol = symbol) { const normalized = forSymbol.trim().toUpperCase(); if (!normalized) { setError('Enter a stock symbol first.'); return; } setSymbol(normalized); setError(''); setSuccess(null); setQuoteBusy(true); setQuote(null); try { setQuote(await getStockPrice(normalized)); } catch (e) { setError(e.message || 'Could not load a quote.'); } finally { setQuoteBusy(false); } }
  function selectSymbol(value) { setSymbol(value); loadQuote(value); }
  const parsedQuantity = quantity === '' ? NaN : Number(quantity); const validQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 1e9;
  const estimatedTotal = quote && validQuantity ? parsedQuantity * Number(quote.price) : null;
  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess(null);
    if (!symbol.trim()) { setError('Stock symbol is required.'); return; }
    if (!validQuantity) { setError('Quantity must be a number greater than zero and within the supported range.'); return; }
    if (!quote || quote.symbol !== symbol.trim().toUpperCase()) { setError('Load a valid quote before submitting a trade.'); return; }
    if (quote.stale) { setError('This quote is stale. Refresh it before placing a trade.'); return; }
    const confirmed = window.confirm(`${side} ${parsedQuantity} ${symbol.toUpperCase()} at an estimated ${currency(quote.price)} per share (${currency(estimatedTotal)}). The server will verify a fresh execution quote. Continue?`);
    if (!confirmed) return;
    setTradeBusy(true);
    try { const result = await executeTrade({ symbol: symbol.trim().toUpperCase(), side, quantity: parsedQuantity }); setSuccess(result); setQuantity(''); setWatchRefresh(key => key + 1); await Promise.allSettled([loadQuote(symbol), getProfile().then(setProfile), onTradeSuccess?.()]); }
    catch (e) { setError(e.message || 'Trade failed. Your portfolio was not changed.'); }
    finally { setTradeBusy(false); }
  }
  return <main className="dashboard trade-page">
    <div className="welcome"><div><span className="eyebrow">MARKET DESK</span><h1>Trade stocks.</h1><p>Practice with virtual USD. Execution prices are verified by the server.</p></div><div className="market-pill">USD · ALPHA VANTAGE</div></div>
    <div className="trade-layout"><div className="trade-main">
      <section className="trade-card"><div className="section-head trade-card-head"><div><span className="eyebrow">TRADE TICKET</span><h2>Place an order</h2></div>{profile && <span className="available-cash">Cash {currency(profile.cash_balance)}</span>}</div>
        <div className="symbol-load"><label>Stock symbol<input value={symbol} onChange={e => { setSymbol(e.target.value.toUpperCase()); setQuote(null); }} maxLength={10} placeholder="e.g. AAPL" onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), loadQuote())} /></label><button className="secondary" onClick={() => loadQuote()} disabled={quoteBusy || !symbol.trim()}>{quoteBusy ? 'Loading…' : 'Load quote'}</button></div>
        {quote && <div className="quote-panel"><div><span className="eyebrow">LATEST AVAILABLE PRICE · USD</span><strong>{currency(quote.price)}</strong></div><div className="quote-times"><span>Quote date <b>{new Date(quote.price_time).toLocaleString()}</b></span><span>Fetched <b>{new Date(quote.fetched_at).toLocaleString()}</b></span></div>{quote.stale && <div className="notice stale-notice">This provider quote is more than 24 hours old. Refresh before trading.</div>}</div>}
        <form className="order-form" onSubmit={submit}><div className="side-toggle" aria-label="Trade side"><button type="button" className={side === 'BUY' ? 'selected buy' : ''} onClick={() => setSide('BUY')}>BUY</button><button type="button" className={side === 'SELL' ? 'selected sell' : ''} onClick={() => setSide('SELL')}>SELL</button></div>
          <label>Quantity <span className="muted">(fractional shares supported)</span><input type="number" inputMode="decimal" min="0.000001" max="1000000000" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} placeholder="0.00" /></label>
          <div className="estimate"><span>Estimated total</span><strong>{estimatedTotal === null ? '—' : currency(estimatedTotal)}</strong><small>Final price is set from a fresh server verified quote.</small></div>
          {error && <div className="notice">{error}</div>}{success && <div className="success-notice"><strong>Trade confirmed</strong><span>{success.side} {success.quantity} {success.symbol} at {currency(success.price)} per share · Total {currency(success.total_amount)}</span><small>Transaction {success.transaction_id} · {new Date(success.recorded_at).toLocaleString()}</small></div>}
          <button className="primary submit-trade" disabled={tradeBusy || !quote || !validQuantity || quote.stale}>{tradeBusy ? 'Submitting…' : `Review ${side.toLowerCase()} order`}</button>
        </form>
      </section>
      <PriceChart symbol={quote?.symbol || ''} />
    </div><aside><Watchlist onSelect={selectSymbol} refreshKey={watchRefresh} /></aside></div>
  </main>;
}
