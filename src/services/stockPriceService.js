import { supabase } from './supabaseClient.js';

async function invoke(body) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('stock-price', { body });
  if (error) {
    const context = error.context;
    if (context && typeof context.json === 'function') {
      try { const payload = await context.json(); if (payload?.error?.message) { const normalized = new Error(payload.error.message); normalized.code = payload.error.code; throw normalized; } } catch (parseError) { if (parseError?.code) throw parseError; }
    }
    throw new Error(error.message || 'Market data request failed.');
  }
  if (data?.error) { const normalized = new Error(data.error.message || 'Market data request failed.'); normalized.code = data.error.code; throw normalized; }
  return data;
}

export const getStockPrice = (symbol) => invoke({ symbol });
export const getPriceHistory = (symbol) => invoke({ symbol, history: true });

export async function getWatchlist() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.from('watchlist').select('id,symbol,created_at').order('symbol');
  if (error) throw error;
  return data;
}
export async function addWatchlistSymbol(symbol) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const normalized = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(normalized)) throw new Error('Enter a valid stock symbol.');
  const { data, error } = await supabase.from('watchlist').insert({ symbol: normalized }).select('id,symbol,created_at').single();
  if (error?.code === '23505') throw new Error(`${normalized} is already on your watchlist.`);
  if (error) throw error;
  return data;
}
export async function removeWatchlistSymbol(id) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { error } = await supabase.from('watchlist').delete().eq('id', id);
  if (error) throw error;
}
