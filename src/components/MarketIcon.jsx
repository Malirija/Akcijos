import React from 'react';

const brands = {
  AAPL: { mark: '●', tone: 'apple' }, MSFT: { mark: '▦', tone: 'microsoft' },
  GOOGL: { mark: 'G', tone: 'google' }, GOOG: { mark: 'G', tone: 'google' },
  AMZN: { mark: 'a', tone: 'amazon' }, META: { mark: '∞', tone: 'meta' },
  NVDA: { mark: 'N', tone: 'nvidia' }, TSLA: { mark: 'T', tone: 'tesla' },
  BTC: { mark: '₿', tone: 'bitcoin' }, ETH: { mark: '◆', tone: 'ethereum' },
};

export default function MarketIcon({ symbol, className = '' }) {
  const key = String(symbol || '').toUpperCase();
  const brand = brands[key] || { mark: key.slice(0, 1) || '$', tone: 'default' };
  return <span className={`market-icon ${brand.tone} ${className}`} aria-hidden="true">
    <span>{brand.mark}</span>
  </span>;
}
