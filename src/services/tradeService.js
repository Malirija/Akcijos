import { supabase } from './supabaseClient.js';
/** Calls the authenticated trade Edge Function. Returns its trade and portfolio snapshot result; throws on HTTP or Supabase errors. */
export async function executeTrade({ symbol, side, quantity }) { const { data, error } = await supabase.functions.invoke('execute-trade', { body: { symbol, side, quantity } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; }
