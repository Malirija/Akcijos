import { supabase } from './supabaseClient.js';
/** Calls the authenticated trade Edge Function. Returns its trade and portfolio snapshot result; throws on HTTP or Supabase errors. */
export async function executeTrade({ symbol, side, quantity }) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('execute-trade', { body: { symbol, side, quantity } });
  if (error) {
    const context = error.context;
    if (context && typeof context.json === 'function') {
      try { const payload = await context.json(); if (payload?.error?.message) throw new Error(payload.error.message); } catch (parseError) { if (parseError?.message && parseError.message !== 'Unexpected end of JSON input') throw parseError; }
    }
    throw new Error(error.message || 'Trade request failed.');
  }
  if (data?.error) throw new Error(data.error.message || 'Trade request failed.');
  return data;
}
