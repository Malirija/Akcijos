import { supabase } from './supabaseClient.js';
/** Fetches a quote through the authenticated stock-price Edge Function; returns symbol, price, price_time, fetched_at and stale status. Throws on request failure. */
export async function getStockPrice(symbol) { const { data, error } = await supabase.functions.invoke('stock-price', { body: { symbol } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; }
