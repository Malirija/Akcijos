import React from 'react';
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, formatUSD } from '../utils/formatters.js';

/** Displays persisted portfolio_snapshots; points are never synthesized. */
export default function PortfolioChart({ snapshots = [], loading = false, error = '' }) {
  const chronological = [...snapshots].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at));
  const axisWidth = Math.min(118, Math.max(82, ...chronological.map(point => formatUSD(point.total_value).length * 7 + 12)));

  return <section className="chart-card portfolio-value-chart" aria-labelledby="portfolio-chart-heading">
    <div className="chart-title"><div><span className="eyebrow">PERFORMANCE</span><h2 id="portfolio-chart-heading">Portfolio value</h2></div><span className="chart-count">{chronological.length} snapshots</span></div>
    {loading ? <div className="chart-state" role="status">Loading portfolio snapshots…</div>
      : error ? <div className="chart-state chart-error" role="alert">Unable to load portfolio snapshots: {error}</div>
        : chronological.length === 0 ? <div className="chart-state">Your portfolio value chart will appear after your first successful trade.</div>
          : chronological.length === 1 ? <div className="chart-state">One snapshot is available. Make another successful trade to connect the points.</div>
            : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chronological} margin={{ top: 12, right: 10, left: 4, bottom: 2 }}>
              <CartesianGrid stroke="#edf0eb" vertical={false} />
              <XAxis dataKey="recorded_at" type="category" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis dataKey="total_value" type="number" tickFormatter={formatUSD} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={axisWidth} />
              <defs><linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#59a96a" stopOpacity={0.32} /><stop offset="100%" stopColor="#59a96a" stopOpacity={0.015} /></linearGradient></defs>
              <Tooltip cursor={{ stroke: '#7fae78', strokeDasharray: '4 4' }} labelFormatter={formatDateTime} formatter={value => [formatUSD(value), 'Portfolio value']} contentStyle={{ borderRadius: 10, borderColor: '#dce9dc', background: '#ffffffed', boxShadow: '0 8px 24px #23442a18', fontSize: 12 }} />
              <Area type="monotone" dataKey="total_value" stroke="none" fill="url(#portfolioFill)" activeDot={false} />
              <Line type="monotone" dataKey="total_value" name="Portfolio value" stroke="#39834a" strokeWidth={3} dot={{ r: 3.5, fill: '#fff', stroke: '#39834a', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#39834a', stroke: '#fff', strokeWidth: 3 }} />
            </LineChart></ResponsiveContainer></div>}
    <p className="chart-note">Each point is a portfolio snapshot recorded after a successful trade. This is not a continuous intraday valuation, so gaps between points are expected.</p>
  </section>;
}
