export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
export function validSymbol(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9.]{0,9}$/.test(value); }
export async function fetchQuote(symbol: string) {
  const key = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!key) throw new Error('Market data is not configured: ALPHA_VANTAGE_API_KEY is missing.');
  const url = new URL('https://www.alphavantage.co/query'); url.searchParams.set('function','GLOBAL_QUOTE'); url.searchParams.set('symbol',symbol); url.searchParams.set('apikey',key);
  const response = await fetch(url); if (!response.ok) throw new Error(`Market provider returned HTTP ${response.status}.`);
  const payload = await response.json(); const quote = payload['Global Quote'];
  const price = Number(quote?.['05. price']); const quoteTime = quote?.['07. latest trading day'];
  if (!Number.isFinite(price) || price <= 0 || !quoteTime) throw new Error(payload.Note || payload.Information || 'No valid quote returned for this symbol.');
  const price_time = new Date(`${quoteTime}T21:00:00Z`).toISOString();
  return { symbol, price: Number(price.toFixed(6)), price_time, fetched_at: new Date().toISOString(), stale: Date.now()-Date.parse(price_time)>24*60*60*1000 };
}
export async function cacheQuote(quote: Awaited<ReturnType<typeof fetchQuote>>) {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!serviceKey) throw new Error('Market cache is not configured: Supabase server key is missing.');
  const serverClient = (await import('https://esm.sh/@supabase/supabase-js@2')).createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });
  const { error } = await serverClient.rpc('cache_market_price', { p_symbol: quote.symbol, p_price: quote.price, p_price_time: quote.price_time, p_fetched_at: quote.fetched_at });
  if (error) throw new Error(`Quote fetched but price cache could not be updated: ${error.message}`);
}
