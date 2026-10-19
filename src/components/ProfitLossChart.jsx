import React from 'react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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

  return <section className="chart-card profit-loss-chart" aria-labelledby="profit-loss-chart-heading">
    <div className="chart-title"><div><span className="eyebrow">PERFORMANCE</span><h2 id="profit-loss-chart-heading">Profit / loss</h2></div><span className="chart-count">{chronological.length} snapshots</span></div>
    {loading ? <div className="chart-state" role="status">Loading portfolio snapshots…</div>
      : error ? <div className="chart-state chart-error" role="alert">Unable to load profit / loss: {error}</div>
        : chronological.length === 0 ? <div className="chart-state">Profit and loss history will appear after successful trades record snapshots.</div>
          : <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={chronological} margin={{ top: 12, right: 10, left: 4, bottom: 2 }}>
            <CartesianGrid stroke="#edf0eb" vertical={false} />
            <XAxis dataKey="recorded_at" type="category" tickFormatter={value => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} tickLine={false} axisLine={false} minTickGap={28} />
            <YAxis type="number" tickFormatter={formatUSD} tickLine={false} axisLine={false} width={82} />
            <ReferenceLine y={0} stroke="#9aa39a" strokeDasharray="4 4" />
            <Tooltip labelFormatter={formatDateTime} formatter={value => value == null ? ['Unavailable', ''] : [formatUSD(value), '']} contentStyle={{ borderRadius: 8, borderColor: '#e6eae4', fontSize: 12 }} />
            <Legend />
            {hasRealized && <Line type="linear" dataKey="realized_pl" name="Realized P/L" stroke="#668c32" strokeWidth={2.3} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls={false} />}
            {hasUnrealized && <Line type="linear" dataKey="unrealized_pl" name="Unrealized P/L" stroke="#527c85" strokeWidth={2.3} dot={{ r: 2.5 }} activeDot={{ r: 5 }} connectNulls={false} />}
          </LineChart></ResponsiveContainer></div>}
    <p className="chart-note">Realized P/L accumulates from completed SELL transactions. Unrealized P/L reflects current positions valued at the latest known prices. Missing snapshot values remain gaps in the chart.</p>
  </section>;
}
