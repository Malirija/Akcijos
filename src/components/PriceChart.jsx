import React, { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getPriceHistory } from '../services/stockPriceService.js';

const money = value => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function PriceChart({ symbol }) {
  const [state, setState] = useState({ loading: false, data: [], error: '' });
  useEffect(() => {
    if (!symbol) { setState({ loading: false, data: [], error: '' }); return; }
    let active = true;
    setState({ loading: true, data: [], error: '' });
    getPriceHistory(symbol).then(result => { if (active) setState({ loading: false, data: result.data || [], error: '' }); })
      .catch(error => { if (active) setState({ loading: false, data: [], error: error.message || 'Could not load daily history.' }); });
    return () => { active = false; };
  }, [symbol]);
  return <section className="chart-card">
    <div className="chart-heading"><div><span className="eyebrow">PRICE HISTORY</span><h3>{symbol || 'Select a stock'}</h3></div><span className="chart-label">Historical daily closing prices · USD</span></div>
    {state.loading ? <div className="chart-state">Loading historical daily prices…</div> : state.error ? <div className="chart-state chart-error">{state.error}</div> : !state.data.length ? <div className="chart-state">Select a symbol to load available daily price history.</div> :
      <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><LineChart data={state.data} margin={{ top: 10, right: 18, bottom: 5, left: 8 }}>
        <CartesianGrid stroke="#edf0eb" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={32} /><YAxis domain={['auto', 'auto']} tickFormatter={money} tick={{ fontSize: 10 }} width={72} />
        <Tooltip formatter={value => [money(value), 'Close']} labelFormatter={label => `Date: ${label}`} />
        <Line type="monotone" dataKey="price" stroke="#729733" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div>}
  </section>;
}
