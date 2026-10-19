import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cacheQuote, corsHeaders, errorResponse, fetchQuote, json, MarketError, normalizeSymbol, requireUser, validSymbol } from '../_shared/market.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const user = await requireUser(req);
    const body = await req.json(); const symbol = typeof body.symbol === 'string' ? normalizeSymbol(body.symbol) : '';
    const side = typeof body.side === 'string' ? body.side.toUpperCase() : '';
    const quantity = Number(body.quantity);
    if (!validSymbol(symbol) || !['BUY','SELL'].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1e9) return json({ error: 'Provide a valid symbol, BUY or SELL side, and positive quantity.' }, 400);
    // Fresh provider quote is obtained before the transaction. Price cannot be supplied by the browser.
    const quote = await fetchQuote(symbol);
    if (quote.stale) throw new MarketError('STALE_QUOTE', 'The provider quote is more than 24 hours old. Trading is unavailable until a current quote can be verified.', 409);
    await cacheQuote(quote);
    // The RPC is server-role-only to prevent clients from passing an arbitrary p_price.
    // The user ID comes only from the Auth user verified above.
    const serverClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data, error } = await serverClient.rpc('execute_trade', { p_symbol: symbol, p_side: side, p_quantity: quantity, p_price: quote.price, p_user_id: user.id });
    if (error) {
      const message = error.message;
      const code = /Insufficient cash/i.test(message) ? 'INSUFFICIENT_CASH' : /Insufficient shares/i.test(message) ? 'INSUFFICIENT_SHARES' : 'TRADE_REJECTED';
      const safeMessage = /Insufficient cash|Insufficient shares|Quantity|Invalid symbol|Side must|below supported precision/i.test(message) ? message : 'Trade could not be completed.';
      return json({ error: { code, message: safeMessage } }, 400);
    }
    return json({ ...data, quote });
  } catch (error) { return errorResponse(error); }
});
