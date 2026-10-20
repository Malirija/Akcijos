import React, { useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { getSession, login, logout, onSessionChange, register } from './services/authService.js';
import { isSupabaseConfigured } from './services/supabaseClient.js';
import PortfolioPage from './pages/PortfolioPage.jsx';
import HistoryPage from './pages/HistoryPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import TradePage from './pages/TradePage.jsx';

function Brand() {
  return <Link className="brand" to="/app"><span className="brand-mark">↗</span> stockroom<span className="brand-period">.</span></Link>;
}

function ConfigNotice() {
  return <main className="center"><div className="auth-card"><Brand /><span className="eyebrow">SETUP REQUIRED</span><h1>Connect your Supabase project</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your local <code>.env</code> file, then restart Vite.</p><p>Apply the database migration and deploy the Edge Functions to enable sign in and live prices.</p></div></main>;
}

function AuthPage({ mode }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const signup = mode === 'register';

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      if (signup) {
        const data = await register({ email: form.get('email'), password: form.get('password'), nickname: form.get('nickname') });
        if (!data.session) {
          setError('Check your email to confirm your account, then sign in.');
          return;
        }
      } else {
        await login({ email: form.get('email'), password: form.get('password') });
      }
      navigate('/app');
    } catch (err) {
      setError(err.message || 'Unable to authenticate.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="center"><div className="auth-card"><Brand /><span className="eyebrow">VIRTUAL TRADING · USD</span><h1>{signup ? 'Create your account' : 'Welcome back'}</h1><p className="muted">{signup ? 'Start with $10,000 in virtual cash.' : 'Sign in to view your portfolio.'}</p><form onSubmit={submit}>{signup && <label>Nickname<input name="nickname" placeholder="How should we address you?" maxLength="40" /></label>}<label>Email<input name="email" type="email" required autoComplete="email" placeholder="you@example.com" /></label><label>Password<input name="password" type="password" required minLength="8" autoComplete={signup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" /></label>{error && <div className="notice">{error}</div>}<button className="primary" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} <span>↗</span></button></form><p className="switch">{signup ? 'Already have an account?' : 'New to Stockroom?'} <Link to={signup ? '/login' : '/register'}>{signup ? 'Sign in' : 'Create account'}</Link></p></div></main>;
}

function Guard({ session, children }) {
  return session ? children : <Navigate to="/login" replace />;
}

function Dashboard({ session, children, title }) {
  const navigate = useNavigate();
  const [error, setError] = useState('');

  async function signOut() {
    try {
      await logout();
      navigate('/login');
    } catch (err) {
      setError(err.message);
    }
  }

  return <div className="shell"><header className="topbar"><Brand /><nav className="main-nav" aria-label="Main navigation"><NavLink end to="/app">Portfolio</NavLink><NavLink to="/app/trade">Trade</NavLink><NavLink to="/app/history">History / Stats</NavLink><NavLink to="/app/settings">Settings</NavLink></nav><div className="nav-right"><span className="user-email">{session.user.email}</span><button className="quiet" onClick={signOut}>Sign out</button></div></header><main className="dashboard">{title && <div className="page-heading"><div><span className="eyebrow">YOUR PAPER PORTFOLIO</span><h1>{title}</h1></div></div>}{children}</main><footer>Stockroom is a virtual trading simulator. No real money is involved.</footer>{error && <div className="global-error">{error}</div>}</div>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let active = true;
    getSession()
      .then(currentSession => { if (active) setSession(currentSession); })
      .catch(err => { if (active) { setError(err.message); setSession(null); } });
    const stop = onSessionChange(currentSession => setSession(currentSession));
    return () => { active = false; stop(); };
  }, []);

  if (!isSupabaseConfigured) return <ConfigNotice />;
  if (session === undefined) return <main className="center"><div className="loading">Restoring your session…</div></main>;

  return <><Routes>
    <Route path="/login" element={session ? <Navigate to="/app" replace /> : <AuthPage mode="login" />} />
    <Route path="/register" element={session ? <Navigate to="/app" replace /> : <AuthPage mode="register" />} />
    <Route path="/app" element={<Guard session={session}><Dashboard session={session}><PortfolioPage /></Dashboard></Guard>} />
    <Route path="/app/trade" element={<Guard session={session}><Dashboard session={session} title="Trade"><TradePage /></Dashboard></Guard>} />
    <Route path="/app/history" element={<Guard session={session}><Dashboard session={session} title="Transaction history"><HistoryPage /></Dashboard></Guard>} />
    <Route path="/app/settings" element={<Guard session={session}><Dashboard session={session} title="Settings"><SettingsPage session={session} /></Dashboard></Guard>} />
    <Route path="*" element={<Navigate to={session ? '/app' : '/login'} replace />} />
  </Routes>{error && <div className="global-error">{error}</div>}</>;
}
