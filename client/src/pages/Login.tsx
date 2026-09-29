import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Radio, KeyRound, Mail, User, ShieldAlert, X, CheckCircle2, Eye, EyeOff, Sun, Moon } from 'lucide-react';

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);

export const Login: React.FC = () => {
  const { login, apiUrl } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isForgot, setIsForgot] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');

  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setMessage(data.message);
      setIsRegister(false);
      setUsername('');
      setPassword('');
      setConfirmPassword('');
      setEmail('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Request failed');
      }

      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async (gEmail: string, gName?: string, gPicture?: string) => {
    setError('');
    setMessage('');
    setGoogleLoading(true);

    try {
      const res = await fetch(`${apiUrl}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: gEmail,
          name: gName || gEmail.split('@')[0],
          picture: gPicture || `https://api.dicebear.com/7.x/bottts/svg?seed=${gEmail}`
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Google authentication failed');
      }

      setShowGoogleModal(false);
      login(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* Top right Theme Toggle */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        className="absolute top-6 right-6 z-20 p-2.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 rounded-xl backdrop-blur-md shadow-lg transition-all flex items-center gap-2 text-xs font-semibold"
      >
        {theme === 'dark' ? (
          <>
            <Sun size={18} className="text-amber-400" />
            <span>Light Theme</span>
          </>
        ) : (
          <>
            <Moon size={18} className="text-indigo-600" />
            <span>Dark Theme</span>
          </>
        )}
      </button>

      {/* Dynamic background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md p-8 rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur-xl shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mx-auto mb-4 text-white shadow-lg shadow-brand-500/20">
            <Radio size={24} className="animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold font-outfit text-white">Smart RFID Library</h2>
          <p className="text-xs text-slate-400 mt-1">
            {isForgot
              ? 'Reset your administrator or operator password'
              : isRegister
              ? 'Register a new library operator account'
              : 'B.Tech CS Project Management Dashboard'}
          </p>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-lg bg-rose-500/10 border border-rose-500/20 flex gap-3 text-xs text-rose-400">
            <ShieldAlert size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="p-4 mb-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
            {message}
          </div>
        )}

        {!isForgot && !isRegister ? (
          <>
            {/* Google Sign In Button */}
            <button
              type="button"
              onClick={() => setShowGoogleModal(true)}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center py-3 px-4 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-sm font-semibold text-slate-200 rounded-lg transition-all shadow-md hover:border-slate-500 mb-5 disabled:opacity-50"
            >
              <GoogleIcon />
              {googleLoading ? 'Signing in with Google...' : 'Continue with Google'}
            </button>

            <div className="relative flex items-center justify-center my-4">
              <div className="border-t border-slate-800 w-full" />
              <span className="bg-slate-900/90 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider absolute">
                or sign in with password
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-2">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Enter username (e.g. admin)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 pl-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                  />
                  <User size={16} className="absolute left-4 top-3.5 text-slate-600" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-semibold text-slate-400">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgot(true);
                      setIsRegister(false);
                      setError('');
                      setMessage('');
                    }}
                    className="text-xs text-brand-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Enter password (e.g. password123)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 pl-11 pr-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                  />
                  <KeyRound size={16} className="absolute left-4 top-3.5 text-slate-600" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-brand-600 hover:bg-brand-500 active:bg-brand-700 text-sm text-white font-bold rounded-lg shadow-lg shadow-brand-500/20 hover:shadow-brand-500/30 transition-all disabled:opacity-50 mt-2"
              >
                {loading ? 'Authenticating...' : 'Sign In'}
              </button>

              <div className="text-center mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setIsForgot(false);
                    setError('');
                    setMessage('');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-250 transition-colors"
                >
                  Don't have an account?{' '}
                  <span className="text-brand-400 font-bold hover:underline">Create New Account</span>
                </button>
              </div>
            </form>
          </>
        ) : isRegister ? (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Username</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Choose username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 pl-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                />
                <User size={16} className="absolute left-4 top-3.5 text-slate-600" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                />
                <Mail size={16} className="absolute left-4 top-3.5 text-slate-600" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-11 pr-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                />
                <KeyRound size={16} className="absolute left-4 top-3.5 text-slate-600" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 pl-11 pr-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                />
                <KeyRound size={16} className="absolute left-4 top-3.5 text-slate-600" />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  title={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-sm text-white font-bold rounded-lg shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Register Operator Account'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                setError('');
                setMessage('');
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 font-semibold rounded-lg transition-all"
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleForgot} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-2">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="admin@library.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 pl-11 rounded-lg bg-slate-950/60 border border-slate-800 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500 transition-all"
                />
                <Mail size={16} className="absolute left-4 top-3.5 text-slate-600" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-sm text-white font-bold rounded-lg shadow-lg shadow-brand-500/20 transition-all disabled:opacity-50 mt-2"
            >
              {loading ? 'Sending email...' : 'Send Password Reset Link'}
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgot(false);
                setError('');
                setMessage('');
              }}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 font-semibold rounded-lg transition-all"
            >
              Back to Login
            </button>
          </form>
        )}
      </div>

      {/* Google Sign-In Account Selector Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <GoogleIcon />
              <div>
                <h3 className="text-lg font-bold text-white">Sign in with Google</h3>
                <p className="text-xs text-slate-400">Choose a Google Account to continue</p>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <button
                onClick={() =>
                  handleGoogleLogin(
                    'admin@library.com',
                    'System Administrator',
                    'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
                  )
                }
                disabled={googleLoading}
                className="w-full p-3 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-3 transition-all group"
              >
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=admin"
                  alt="Admin"
                  className="w-9 h-9 rounded-full bg-brand-900/50 p-1 border border-brand-500/30"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white group-hover:text-brand-300 transition-colors">
                    Admin Google Account
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">admin@library.com</p>
                </div>
                <CheckCircle2 size={16} className="text-slate-600 group-hover:text-brand-400" />
              </button>

              <button
                onClick={() =>
                  handleGoogleLogin(
                    'librarian1@library.com',
                    'Librarian Operator',
                    'https://api.dicebear.com/7.x/bottts/svg?seed=librarian1'
                  )
                }
                disabled={googleLoading}
                className="w-full p-3 text-left rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 flex items-center gap-3 transition-all group"
              >
                <img
                  src="https://api.dicebear.com/7.x/bottts/svg?seed=librarian1"
                  alt="Librarian"
                  className="w-9 h-9 rounded-full bg-emerald-900/50 p-1 border border-emerald-500/30"
                />
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                    Librarian Google Account
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">librarian1@library.com</p>
                </div>
                <CheckCircle2 size={16} className="text-slate-600 group-hover:text-emerald-400" />
              </button>
            </div>

            <div className="border-t border-slate-800 pt-4 mt-2">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                Or Sign In with Any Google Email:
              </label>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customGoogleEmail) {
                    handleGoogleLogin(customGoogleEmail, customGoogleName);
                  }
                }}
                className="space-y-2"
              >
                <input
                  type="email"
                  required
                  placeholder="your.email@gmail.com"
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
                <input
                  type="text"
                  placeholder="Your Full Name (optional)"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                />
                <button
                  type="submit"
                  disabled={googleLoading || !customGoogleEmail}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-xs text-white font-bold rounded-lg transition-all disabled:opacity-50 mt-1"
                >
                  {googleLoading ? 'Signing in...' : 'Sign In with Custom Google Account'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

