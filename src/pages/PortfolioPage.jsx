import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolioSummary, getPositions, getPositionPrices, getSnapshots } from '../services/portfolioService.js';
import PortfolioChart from '../components/PortfolioChart.jsx';
import ProfitLossChart from '../components/ProfitLossChart.jsx';
import { formatDateTime, formatQuantity, formatUSD } from '../utils/formatters.js';
import MarketIcon from '../components/MarketIcon.jsx';

const quoteIsStale = quote => {
  if (!quote?.fetched_at) return true;
  const fetchedAt = new Date(quote.fetched_at).getTime();
  return !Number.isFinite(fetchedAt) || Date.now() - fetchedAt > 86400000;
};

function Stat({ label, value, tone, detail }) {
  return <article className="metric-card"><span>{label}</span><strong className={tone || ''}>{value}</strong>{detail && <small>{detail}</small>}</article>;
}

export default function PortfolioPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [period, setPeriod] = useState('ALL');

  useEffect(() => {
    let active = true;
    Promise.all([getPortfolioSummary(), getPositions(), getPositionPrices(), getSnapshots()])
      .then(([summaryRows, positions, prices, snapshots]) => {
        if (!active) return;
        setData({
          summary: Array.isArray(summaryRows) ? summaryRows[0] : summaryRows,
          positions,
          prices: Object.fromEntries(prices.map(price => [price.symbol, price])),
          snapshots,
        });
      })
      .catch(loadError => { if (active) setError(loadError.message || 'Unable to load your portfolio.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  const snapshots = data?.snapshots || [];
  const chartData = useMemo(() => {
    if (period === 'ALL') return snapshots;
    const since = Date.now() - Number(period) * 86400000;
    return snapshots.filter(point => new Date(point.recorded_at).getTime() >= since);
  }, [snapshots, period]);

  if (busy) return <div className="loading" role="status">Loading your portfolio…</div>;
  if (error) return <div className="notice" role="alert">{error} Check your Supabase configuration and database setup.</div>;
  if (!data?.summary) return <div className="notice" role="alert">Portfolio summary is unavailable.</div>;

  const summary = data.summary;
  const positions = data.positions || [];
  const chartRanges = [['30', '1M'], ['90', '3M'], ['365', '1Y'], ['ALL', 'ALL']];

  return <>
    <div className="welcome"><div><span className="eyebrow">YOUR PAPER PORTFOLIO</span><h1>Your portfolio</h1><p>Current balances and open positions, valued in USD.</p></div><div className="market-pill"><span className="pulse" /> MARKET DATA · ALPHA VANTAGE</div></div>
    <section className="metrics portfolio-metrics">
      <article className="metric-card main-metric"><span>Total portfolio value</span><strong>{formatUSD(summary.total_value)}</strong><small>USD · summary valuation uses average cost when a quote is missing</small></article>
      <Stat label="Available cash" value={formatUSD(summary.cash_balance)} detail="Ready to invest" />
      <Stat label="Market value of positions" value={formatUSD(summary.positions_value)} detail="Cached prices; average-cost fallback where unavailable" />
      <Stat label="Realized P/L" value={`${Number(summary.realized_pl) > 0 ? '+' : ''}${formatUSD(summary.realized_pl)}`} tone={Number(summary.realized_pl) >= 0 ? 'positive' : 'negative'} detail="Closed trade results" />
      <Stat label="Unrealized P/L" value={`${Number(summary.unrealized_pl) > 0 ? '+' : ''}${formatUSD(summary.unrealized_pl)}`} tone={Number(summary.unrealized_pl) >= 0 ? 'positive' : 'negative'} detail="Open positions" />
    </section>

    <div className="charts-grid"><PortfolioChart snapshots={chartData} /><ProfitLossChart snapshots={chartData} /></div>
    <div className="history-link"><Link to="/app/history">View transaction history →</Link><div className="period-picker" aria-label="Chart time range">{chartRanges.map(([value, label]) => <button key={value} className={period === value ? 'selected' : ''} onClick={() => setPeriod(value)}>{label}</button>)}</div></div>

    <div className="section-head"><div><span className="eyebrow">POSITIONS</span><h2>Current positions</h2></div><span className="count">{positions.length} {positions.length === 1 ? 'stock' : 'stocks'}</span></div>
    <div className="table-scroll positions-table"><table><thead><tr><th>Stock</th><th>Quantity</th><th>Average acquisition price</th><th>Latest known price</th><th>Market value</th><th>Unrealized P/L</th></tr></thead><tbody>{positions.map(position => {
      const quote = data.prices[position.symbol];
      const hasQuote = Boolean(quote && Number(quote.price) > 0);
      const stale = hasQuote && quoteIsStale(quote);
      const quantity = Number(position.quantity);
      const marketValue = hasQuote ? quantity * Number(quote.price) : null;
      const unrealized = hasQuote ? marketValue - quantity * Number(position.average_buy_price) : null;
      return <tr key={position.id}><td><span className="position-stock"><MarketIcon symbol={position.symbol} /><strong>{position.symbol}</strong></span></td><td>{formatQuantity(quantity)}</td><td>{formatUSD(position.average_buy_price)}</td><td>{hasQuote ? <>{formatUSD(quote.price)}<small className={`quote-label ${stale ? 'stale' : ''}`}>{stale ? 'Stale quote' : 'Current cached quote'} · {formatDateTime(quote.price_time)}</small></> : <span className="unavailable-price">Unavailable</span>}</td><td>{marketValue === null ? <span className="unavailable-price">Unavailable</span> : formatUSD(marketValue)}</td><td className={unrealized === null ? '' : unrealized >= 0 ? 'positive' : 'negative'}>{unrealized === null ? <span className="unavailable-price">Unavailable</span> : `${unrealized > 0 ? '+' : ''}${formatUSD(unrealized)}`}</td></tr>;
    })}</tbody></table>{positions.length === 0 && <div className="empty table-empty"><span className="empty-icon">↗</span><strong>Your portfolio starts here</strong><p>Once you make a virtual trade, your open positions will appear here.</p></div>}</div>
  </>;
}
