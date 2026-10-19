import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export type MarketErrorCode = 'INVALID_SYMBOL' | 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'NO_DATA' | 'NETWORK_ERROR' | 'CONFIGURATION_ERROR' | 'CACHE_ERROR' | 'AUTH_REQUIRED' | 'INVALID_REQUEST' | 'STALE_QUOTE';
export class MarketError extends Error {
  constructor(public code: MarketErrorCode, message: string, public status = 502) { super(message); }
}

export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
export function validSymbol(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9.]{0,9}$/.test(value.trim()); }
export const normalizeSymbol = (value: string) => value.trim().toUpperCase();
const stale = (priceTime: string) => Date.now() - Date.parse(priceTime) > 24 * 60 * 60 * 1000;

async function providerRequest(params: Record<string, string>) {
  const key = Deno.env.get('ALPHA_VANTAGE_API_KEY');
  if (!key) throw new MarketError('CONFIGURATION_ERROR', 'Market data is not configured.', 503);
  const url = new URL('https://www.alphavantage.co/query');
  Object.entries({ ...params, apikey: key }).forEach(([name, value]) => url.searchParams.set(name, value));
  let response: Response;
  try { response = await fetch(url); } catch { throw new MarketError('NETWORK_ERROR', 'Could not reach the market data provider.'); }
  if (!response.ok) throw new MarketError('NETWORK_ERROR', 'The market data provider is temporarily unavailable.');
  let payload: Record<string, any>;
  try { payload = await response.json(); } catch { throw new MarketError('PROVIDER_ERROR', 'The market data provider returned an unreadable response.'); }
  const message = String(payload.Note || payload.Information || payload['Error Message'] || '');
  if (/frequency|rate limit|call frequency|per minute|per day/i.test(message)) throw new MarketError('RATE_LIMITED', 'Market data rate limit reached. Please try again later.', 429);
  if (payload['Error Message']) throw new MarketError('INVALID_SYMBOL', 'No market data was found for that symbol.', 404);
  if (message) throw new MarketError('PROVIDER_ERROR', 'The market data provider could not complete the request.');
  return payload;
}

export async function fetchQuote(symbol: string) {
  const payload = await providerRequest({ function: 'GLOBAL_QUOTE', symbol });
  const quote = payload['Global Quote'];
  const price = Number(quote?.['05. price']);
  const day = quote?.['07. latest trading day'];
  if (!Number.isFinite(price) || price <= 0 || typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new MarketError('NO_DATA', 'No valid latest quote is currently available for this symbol.', 404);
  }
  const price_time = new Date(`${day}T21:00:00.000Z`).toISOString();
  const quoteResult = { symbol, price: Number(price.toFixed(6)), price_time, fetched_at: new Date().toISOString(), stale: stale(price_time), source: 'Alpha Vantage' };
  await cacheQuote(quoteResult);
  return quoteResult;
}

export async function fetchDailyHistory(symbol: string) {
  const payload = await providerRequest({ function: 'TIME_SERIES_DAILY', symbol, outputsize: 'compact' });
  const series = payload['Time Series (Daily)'];
  if (!series || typeof series !== 'object') throw new MarketError('NO_DATA', 'Daily price history is not currently available for this symbol.', 404);
  const data = Object.entries(series).map(([date, values]: [string, any]) => ({ date, price: Number(values?.['4. close']) }))
    .filter(point => /^\d{4}-\d{2}-\d{2}$/.test(point.date) && Number.isFinite(point.price) && point.price > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (!data.length) throw new MarketError('NO_DATA', 'Daily price history is not currently available for this symbol.', 404);
  return { symbol, data, fetched_at: new Date().toISOString(), source: 'Alpha Vantage' };
}

export async function cacheQuote(quote: { symbol: string; price: number; price_time: string; fetched_at: string }) {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!serviceKey || !url) throw new MarketError('CONFIGURATION_ERROR', 'Market data storage is not configured.', 503);
  const serverClient = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { error } = await serverClient.rpc('cache_market_price', { p_symbol: quote.symbol, p_price: quote.price, p_price_time: quote.price_time, p_fetched_at: quote.fetched_at });
  if (error) throw new MarketError('CACHE_ERROR', 'The quote could not be safely recorded. Please try again.', 503);
}

// Reuse a valid quote for five minutes to reduce Alpha Vantage calls. This server-side
// cache window does not imply real-time data; provider price_time and fetched_at remain distinct.
export async function recentCachedQuote(symbol: string) {
  const url = Deno.env.get('SUPABASE_URL'); const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await client.from('market_prices').select('symbol,price,price_time,fetched_at').eq('symbol', symbol).maybeSingle();
  if (!data || Date.now() - Date.parse(data.fetched_at) > 5 * 60 * 1000) return null;
  return { ...data, price: Number(data.price), stale: stale(data.price_time), source: 'Alpha Vantage' };
}

export async function requireUser(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw new MarketError('AUTH_REQUIRED', 'Authentication required.', 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) throw new MarketError('AUTH_REQUIRED', 'Your session is invalid or expired.', 401);
  return user;
}

export function errorResponse(error: unknown) {
  const known = error instanceof MarketError ? error : new MarketError('PROVIDER_ERROR', 'Market data request failed.');
  return json({ error: { code: known.code, message: known.message } }, known.status);
}
