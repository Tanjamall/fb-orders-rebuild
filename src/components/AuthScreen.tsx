import React, { useState } from 'react';
import { ShoppingBag, ArrowRight, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function AuthScreen() {
  const { user, loading, authError, signInWithEmail, signUpWithEmail, logout } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (mode === 'signup') {
        const signedIn = await signUpWithEmail(email, password);
        setPassword('');
        if (!signedIn) {
          setNotice('Check your email to confirm your account, then return here and sign in. If you already have an account, sign in instead.');
          setMode('signin');
        }
      } else {
        await signInWithEmail(email, password);
        setPassword('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to sign in. Try again.');
    } finally { setBusy(false); }
  };
  return (
    <main className="min-h-dvh bg-slate-100 text-slate-900 px-5 py-10 sm:py-20 flex items-center justify-center">
      <section className="w-full max-w-md" aria-labelledby="auth-title">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white"><ShoppingBag aria-hidden="true" size={23} /></span>
          <div><p className="font-bold text-lg">MarketPulse</p><p className="text-sm text-slate-500">FB Orders Tracking · Development</p></div>
        </div>
        {loading ? <div role="status" className="flex items-center gap-3 py-12"><LoaderCircle className="animate-spin" aria-hidden="true" />Opening your workspace…</div> : user ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h1 id="auth-title" className="text-2xl font-bold tracking-tight">Workspace access</h1>
            <p className="mt-3 text-sm text-slate-600 break-words">Signed in as {user.email}.</p>
            <p role="status" className="mt-4 text-base leading-relaxed">{authError || 'Your account needs an approved workspace membership before you can continue.'}</p>
            <button onClick={() => window.location.reload()} className="mt-6 w-full min-h-11 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700">Check access again</button>
            <button onClick={() => void logout()} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-4 py-2 font-semibold hover:bg-slate-50">Sign out</button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <h1 id="auth-title" className="text-2xl font-bold tracking-tight">{mode === 'signin' ? 'Sign in to your workspace' : 'Create your test account'}</h1>
            <p className="mt-2 mb-6 text-sm leading-relaxed text-slate-600">{mode === 'signin' ? 'Manage orders, stock and your team in one place.' : 'New accounts need workspace approval before they can access any business data.'}</p>
            <label htmlFor="auth-email" className="mb-2 block text-sm font-semibold">Email</label>
            <input id="auth-email" type="email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={busy} value={email} onChange={e => setEmail(e.target.value)} className="mb-5 min-h-12 w-full rounded-xl border border-slate-300 px-3 text-base focus:outline-2 focus:outline-blue-600" />
            <label htmlFor="auth-password" className="mb-2 block text-sm font-semibold">Password</label>
            <div className="relative">
              <input id="auth-password" type={visible ? 'text' : 'password'} name="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} className="min-h-12 w-full rounded-xl border border-slate-300 pl-3 pr-12 text-base focus:outline-2 focus:outline-blue-600" />
              <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} onClick={() => setVisible(!visible)} className="absolute right-0 top-0 flex h-12 w-12 items-center justify-center text-slate-500 hover:text-slate-900">{visible ? <EyeOff size={20} /> : <Eye size={20} />}</button>
            </div>
            {mode === 'signup' && <p className="mt-2 text-sm text-slate-500">Use at least 8 characters.</p>}
            {(error || authError) && <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error || authError}</p>}
            {notice && <p role="status" className="mt-4 rounded-lg bg-blue-50 p-3 text-sm leading-relaxed text-blue-900">{notice}</p>}
            <button type="submit" disabled={busy} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <><LoaderCircle size={18} className="animate-spin" aria-hidden="true" />Please wait…</> : <>{mode === 'signin' ? 'Sign in' : 'Create account'}<ArrowRight size={18} aria-hidden="true" /></>}</button>
            <button type="button" disabled={busy} onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); setNotice(null); setPassword(''); }} className="mt-4 min-h-11 w-full text-sm font-semibold text-blue-700 hover:underline">{mode === 'signin' ? 'New here? Create an account' : 'Already registered? Sign in'}</button>
          </form>
        )}
      </section>
    </main>
  );
}
