import { MarketError, errorResponse, fetchDailyHistory, fetchQuote, json, normalizeSymbol, recentCachedQuote, requireUser, validSymbol } from '../_shared/market.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (req.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed.' } }, 405);
  try {
    await requireUser(req);
    let body: any;
    try { body = await req.json(); } catch { throw new MarketError('INVALID_REQUEST', 'Request body must be valid JSON.', 400); }
    if (!validSymbol(body?.symbol)) throw new MarketError('INVALID_SYMBOL', 'Enter a valid stock symbol.', 400);
    const symbol = normalizeSymbol(body.symbol);
    if (body.history === true) return json(await fetchDailyHistory(symbol));
    const cached = await recentCachedQuote(symbol);
    return json(cached || await fetchQuote(symbol));
  } catch (error) { return errorResponse(error); }
});
