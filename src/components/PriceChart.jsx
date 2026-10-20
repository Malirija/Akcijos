import React, { useEffect, useState } from 'react';
import { Area, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getPriceHistory } from '../services/stockPriceService.js';

const money = value => `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function PriceChart({ symbol }) {
  const [state, setState] = useState({ loading: false, data: [], error: '' });
  const axisWidth = Math.min(118, Math.max(72, ...state.data.map(point => money(point.price).length * 7 + 12)));
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
        <defs><linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#468bd2" stopOpacity={0.28} /><stop offset="100%" stopColor="#468bd2" stopOpacity={0.015} /></linearGradient></defs>
        <CartesianGrid stroke="#e9edf2" strokeDasharray="3 5" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#778497' }} tickLine={false} axisLine={false} minTickGap={32} /><YAxis domain={['auto', 'auto']} tickFormatter={money} tick={{ fontSize: 10, fill: '#778497' }} tickLine={false} axisLine={false} width={axisWidth} />
        <Tooltip cursor={{ stroke: '#77a7d7', strokeDasharray: '4 4' }} formatter={value => [money(value), 'Close']} labelFormatter={label => `Date: ${label}`} contentStyle={{ borderRadius: 10, borderColor: '#dce7f2', background: '#ffffffed', boxShadow: '0 8px 24px #29496918', fontSize: 12 }} />
        <Area type="monotone" dataKey="price" stroke="none" fill="url(#priceFill)" activeDot={false} />
        <Line type="monotone" dataKey="price" stroke="#347fc4" strokeWidth={2.8} dot={false} activeDot={{ r: 5, fill: '#347fc4', stroke: '#fff', strokeWidth: 3 }} isAnimationActive={false} />
      </LineChart></ResponsiveContainer></div>}
  </section>;
}
