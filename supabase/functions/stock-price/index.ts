import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { cacheQuote, corsHeaders, fetchQuote, json, validSymbol } from '../_shared/market.ts';
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const auth = req.headers.get('Authorization'); if (!auth) return json({ error: 'Authentication required' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(); if (authError || !user) return json({ error: 'Invalid session' }, 401);
  try {
    const body = await req.json(); if (!validSymbol(body.symbol)) return json({ error: 'Invalid symbol' }, 400);
    const quote = await fetchQuote(body.symbol.toUpperCase());
    await cacheQuote(quote);
    return json(quote);
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Unable to fetch quote' }, 502); }
});
