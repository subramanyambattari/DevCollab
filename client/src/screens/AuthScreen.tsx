import { useEffect, useState, type FormEvent } from 'react';
import type { AuthCredentials } from '@shared/types';
import { useApiClient } from '../hooks/useApiClient';
import { Feedback } from '../components/Feedback';
import { useCollabStore } from '../store/collab-store';

type AuthMode = 'login' | 'register';

const emptyAuth: AuthCredentials = { username: '', password: '' };

export function AuthScreen() {
  const api = useApiClient();
  const busy = useCollabStore((state) => state.busy);
  const setBusy = useCollabStore((state) => state.setBusy);
  const feedback = useCollabStore((state) => state.feedback);
  const setFeedback = useCollabStore((state) => state.setFeedback);
  const setSession = useCollabStore((state) => state.setSession);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState<AuthCredentials>(emptyAuth);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setFeedback(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback, setFeedback]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);

    try {
      const payload = authMode === 'login' ? await api.login(authForm) : await api.register(authForm);
      setSession(payload.token, payload.user);
      setAuthForm(emptyAuth);
      setFeedback({ type: 'success', message: authMode === 'login' ? 'Logged in.' : 'Account created.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Authentication failed.'
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.14),_transparent_22%)]" />
      <div className="glass relative z-10 w-full max-w-2xl rounded-[2rem] p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="section-title">DevCollab</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Ship together in one shared workspace.
            </h1>
          </div>
          <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-sm text-cyan-100 sm:block">
            React + Node + Socket.IO
          </div>
        </div>

        <p className="max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
          Create a room, chat in real time, track work with a Kanban board, and keep team notes in sync.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            className={authMode === 'login' ? 'button-primary' : 'button-secondary'}
            onClick={() => setAuthMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={authMode === 'register' ? 'button-primary' : 'button-secondary'}
            onClick={() => setAuthMode('register')}
            type="button"
          >
            Register
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            Username
            <input
              className="input-base"
              value={authForm.username}
              onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
              placeholder="alex"
              autoComplete="username"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            Password
            <input
              className="input-base"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
              placeholder="********"
              autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>
          <button className="button-primary mt-2" disabled={busy} type="submit">
            {busy ? 'Please wait...' : authMode === 'login' ? 'Login' : 'Create account'}
          </button>
        </form>

        <div className="mt-4">
          <Feedback feedback={feedback} />
        </div>
      </div>
    </div>
  );
}
