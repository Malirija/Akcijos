import React from 'react';
import { Area, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDateTime, formatUSD } from '../utils/formatters.js';
const numericOrNull = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);

/** Displays realized and unrealized P/L from persisted portfolio_snapshots. */
export default function ProfitLossChart({ snapshots = [], loading = false, error = '' }) {
  const chronological = [...snapshots]
    .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
    .map(snapshot => ({
      ...snapshot,
      realized_pl: numericOrNull(snapshot.realized_pl),
      unrealized_pl: numericOrNull(snapshot.unrealized_pl),
    }))
    .filter(snapshot => Number.isFinite(new Date(snapshot.recorded_at).getTime())
      && (snapshot.realized_pl !== null || snapshot.unrealized_pl !== null));
  const hasRealized = chronological.some(point => point.realized_pl !== null);
  const hasUnrealized = chronological.some(point => point.unrealized_pl !== null);
  const axisWidth = Math.min(118, Math.max(82, ...chronological.flatMap(point => [point.realized_pl, point.unrealized_pl].filter(value => value !== null).map(value => formatUSD(value).length * 7 + 12))));

  return <section className="chart-card profit-loss-chart" aria-labelledby="profit-loss-chart-heading">
    <div className="chart-title"><div><span className="eyebrow">PERFORMANCE</span><h2 id="profit-loss-chart-heading">Profit / loss</h2></div><span className="chart-count">{chronological.length} snapshots</span></div>
    {loading ? <div className="chart-state" role="status">Loading portfolio snapshots…</div>
      : error ? <div className="chart-state chart-error" role="alert">Unable to load profit / loss: {error}</div>
        : chronological.length === 0 ? <div className="chart-state">Profit and loss history will appear after successful trades record snapshots.</div>
          : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chronological} margin={{ top: 12, right: 10, left: 4, bottom: 2 }}>
            <CartesianGrid stroke="#edf0eb" vertical={false} />
            <XAxis dataKey="recorded_at" type="category" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis type="number" tickFormatter={formatUSD} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} width={axisWidth} />
            <ReferenceLine y={0} stroke="#9aa39a" strokeDasharray="4 4" />
            <defs><linearGradient id="realizedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#32a879" stopOpacity={0.3} /><stop offset="100%" stopColor="#32a879" stopOpacity={0.02} /></linearGradient><linearGradient id="unrealizedFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8270d5" stopOpacity={0.24} /><stop offset="100%" stopColor="#8270d5" stopOpacity={0.02} /></linearGradient></defs>
            <Tooltip cursor={{ stroke: '#95a39a', strokeDasharray: '4 4' }} labelFormatter={formatDateTime} formatter={value => value == null ? ['Unavailable', ''] : [formatUSD(value), '']} contentStyle={{ borderRadius: 10, borderColor: '#dce9e4', background: '#ffffffed', boxShadow: '0 8px 24px #23392718', fontSize: 12 }} />
            <Legend />
            {hasRealized && <Area type="monotone" dataKey="realized_pl" name="Realized P/L" stroke="none" fill="url(#realizedFill)" connectNulls={false} activeDot={false} />}
            {hasUnrealized && <Area type="monotone" dataKey="unrealized_pl" name="Unrealized P/L" stroke="none" fill="url(#unrealizedFill)" connectNulls={false} activeDot={false} />}
            {hasRealized && <Line type="monotone" dataKey="realized_pl" name="Realized P/L" stroke="#17865e" strokeWidth={2.8} dot={{ r: 3, fill: '#fff', stroke: '#17865e', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#17865e', stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />}
            {hasUnrealized && <Line type="monotone" dataKey="unrealized_pl" name="Unrealized P/L" stroke="#705cc6" strokeWidth={2.8} dot={{ r: 3, fill: '#fff', stroke: '#705cc6', strokeWidth: 2 }} activeDot={{ r: 5, fill: '#705cc6', stroke: '#fff', strokeWidth: 2 }} connectNulls={false} />}
          </LineChart></ResponsiveContainer></div>}
    <p className="chart-note">Realized P/L accumulates from completed SELL transactions. Unrealized P/L reflects current positions valued at the latest known prices. Missing snapshot values remain gaps in the chart.</p>
  </section>;
}
