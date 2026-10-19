import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, formatUSD } from '../utils/formatters.js';

/** Displays persisted portfolio_snapshots; points are never synthesized. */
export default function PortfolioChart({ snapshots = [], loading = false, error = '' }) {
  const chronological = [...snapshots].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));

  return <section className="chart-card portfolio-value-chart" aria-labelledby="portfolio-chart-heading">
    <div className="chart-title"><div><span className="eyebrow">PERFORMANCE</span><h2 id="portfolio-chart-heading">Portfolio value</h2></div><span className="chart-count">{chronological.length} snapshots</span></div>
    {loading ? <div className="chart-state" role="status">Loading portfolio snapshots…</div>
      : error ? <div className="chart-state chart-error" role="alert">Unable to load portfolio snapshots: {error}</div>
        : chronological.length === 0 ? <div className="chart-state">Your portfolio value chart will appear after your first successful trade.</div>
          : chronological.length === 1 ? <div className="chart-state">One snapshot is available. Make another successful trade to connect the points.</div>
            : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chronological} margin={{ top: 12, right: 10, left: 4, bottom: 2 }}>
              <CartesianGrid stroke="#edf0eb" vertical={false} />
              <XAxis dataKey="recorded_at" type="category" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} minTickGap={28} />
              <YAxis dataKey="total_value" type="number" tickFormatter={formatUSD} tickLine={false} axisLine={false} width={82} />
              <Tooltip labelFormatter={formatDateTime} formatter={value => [formatUSD(value), 'Portfolio value']} contentStyle={{ borderRadius: 8, borderColor: '#e6eae4', fontSize: 12 }} />
              <Line type="linear" dataKey="total_value" name="Portfolio value" stroke="#668c32" strokeWidth={2.5} dot={{ r: 3, fill: '#668c32' }} activeDot={{ r: 5 }} />
            </LineChart></ResponsiveContainer></div>}
    <p className="chart-note">Each point is a portfolio snapshot recorded after a successful trade. This is not a continuous intraday valuation, so gaps between points are expected.</p>
  </section>;
}
