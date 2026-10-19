import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cacheQuote, corsHeaders, fetchQuote, json, validSymbol } from '../_shared/market.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization'); if (!auth) return json({ error: 'Authentication required' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError || !user) return json({ error: 'Invalid session' }, 401);
  try {
    const body = await req.json(); const symbol = typeof body.symbol === 'string' ? body.symbol.toUpperCase() : '';
    const side = typeof body.side === 'string' ? body.side.toUpperCase() : '';
    const quantity = Number(body.quantity);
    if (!validSymbol(symbol) || !['BUY','SELL'].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return json({ error: 'Provide a valid symbol, BUY or SELL side, and positive quantity.' }, 400);
    // Fresh provider quote is obtained before the transaction. Price cannot be supplied by the browser.
    const quote = await fetchQuote(symbol);
    await cacheQuote(quote);
    // The RPC is server-role-only to prevent clients from passing an arbitrary p_price.
    // The user ID comes only from the Auth user verified above.
    const serverClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await serverClient.rpc('execute_trade', { p_symbol: symbol, p_side: side, p_quantity: quantity, p_price: quote.price, p_user_id: user.id });
    if (error) return json({ error: error.message }, 400);
    return json({ ...data, quote });
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to execute trade' }, 502); }
});
