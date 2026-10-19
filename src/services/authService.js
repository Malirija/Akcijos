import { isSupabaseConfigured, supabase } from './supabaseClient.js';
const ready = () => { if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add the required VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY values.'); };
export async function register({ email, password, nickname }) { ready(); const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nickname: nickname?.trim() || '' } } }); if (error) throw error; return data; }
export async function login({ email, password }) { ready(); const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; return data; }
export async function logout() { ready(); const { error } = await supabase.auth.signOut(); if (error) throw error; }
export async function getSession() { ready(); const { data, error } = await supabase.auth.getSession(); if (error) throw error; return data.session; }
export function onSessionChange(callback) { ready(); const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session)); return () => data.subscription.unsubscribe(); }
