import { supabase } from './supabaseClient.js';
const result = async (query) => { const { data, error } = await query; if (error) throw error; return data; };
export const getProfile = () => result(supabase.from('profiles').select('id,nickname,initial_balance,cash_balance,created_at,updated_at').single());
export const getPositions = () => result(supabase.from('positions').select('id,symbol,quantity,average_buy_price,updated_at').order('symbol'));
export const getTransactions = () => result(supabase.from('transactions').select('id,symbol,side,quantity,price,total_amount,realized_pl,executed_at').order('executed_at', { ascending: false }));
export const getSnapshots = () => result(supabase.from('portfolio_snapshots').select('cash_balance,positions_value,total_value,realized_pl,unrealized_pl,recorded_at').order('recorded_at', { ascending: true }));
export const getPortfolioSummary = () => result(supabase.rpc('get_portfolio_summary'));
