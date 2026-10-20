import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/authService.js';
import { getProfile, getWatchlist, updateNickname } from '../services/portfolioService.js';

export default function SettingsPage({ session }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getProfile(), getWatchlist()])
      .then(([currentProfile, savedSymbols]) => {
        if (!active) return;
        setProfile(currentProfile);
        setNickname(currentProfile.nickname || '');
        setWatchlist(savedSymbols || []);
      })
      .catch(loadError => { if (active) setError(loadError.message || 'Unable to load settings.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []);

  async function saveNickname(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const updatedProfile = await updateNickname(nickname);
      setProfile(updatedProfile);
      setNickname(updatedProfile.nickname);
      setMessage('Your nickname has been updated.');
    } catch (saveError) {
      setError(saveError.message || 'Unable to update nickname.');
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    setLoggingOut(true);
    setError('');
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (logoutError) {
      setError(logoutError.message || 'Unable to sign out.');
      setLoggingOut(false);
    }
  }

  if (busy) return <div className="loading" role="status">Loading settings…</div>;
  if (error && !profile) return <div className="notice" role="alert">{error} Check your Supabase configuration and database setup.</div>;

  return <>
    <p className="page-intro">Manage your profile and view your simulator account details.</p>
    {error && <div className="notice" role="alert">{error}</div>}
    <section className="settings-card">
      <div className="settings-intro"><span className="eyebrow">PROFILE</span><h2>Personal details</h2><p>Your nickname appears in your portfolio. Your email is managed by your sign-in provider.</p></div>
      <form className="settings-form" onSubmit={saveNickname}>
        <label>Nickname<input value={nickname} onChange={event => setNickname(event.target.value)} required maxLength={40} /></label>
        <label>Email address<input value={session?.user?.email || ''} readOnly disabled /></label>
        <div className="settings-actions">{message && <span className="saved-message" role="status">{message}</span>}<button className="primary save-button" disabled={saving || !nickname.trim()}>{saving ? 'Saving…' : 'Save nickname'}</button></div>
      </form>
    </section>

    <section className="settings-card account-card"><div><span className="eyebrow">FIXED STARTING BALANCE</span><h2>$10,000 USD</h2><p>Every account starts with a fixed virtual balance of USD 10,000. This initial balance cannot be changed.</p></div><div className="account-badge">VIRTUAL FUNDS</div></section>

    <section className="settings-card watchlist-settings"><div><span className="eyebrow">WATCHLIST</span><h2>Your saved symbols</h2><p>These symbols are saved to your account watchlist.</p></div><div className="watchlist-symbols">{watchlist.length ? watchlist.map(item => <span className="watchlist-chip" key={item.id}>{item.symbol}</span>) : <p className="watchlist-empty">No symbols in your watchlist yet.</p>}</div></section>

    <section className="settings-card logout-card"><div><span className="eyebrow">ACCOUNT</span><h2>Sign out</h2><p>Sign out of Stockroom on this device.</p></div><button type="button" className="secondary-button" onClick={signOut} disabled={loggingOut}>{loggingOut ? 'Signing out…' : 'Sign out'}</button></section>
  </>;
}
