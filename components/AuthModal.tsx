import React, { useState } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Key,
  Shield,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  LogOut,
  Sparkles,
  ArrowRight,
  Database
} from 'lucide-react';
import { serverApi, type UserProfile } from '../services/serverApiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  onUserChange: (user: UserProfile | null) => void;
  showToast: (msg: string) => void;
  onOpenAdminConsole?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
  showToast,
  onOpenAdminConsole
}) => {
  const [tab, setTab] = useState<'login' | 'register' | 'license'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await serverApi.login(email, password);
      onUserChange(res.user);
      showToast(`Welcome back, ${res.user.name || res.user.email}!`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const res = await serverApi.register({
        email,
        password,
        name,
        licenseKey: licenseKey.trim() || undefined
      });
      onUserChange(res.user);
      showToast(`Account created! Logged in as ${res.user.email}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licenseKey.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await serverApi.redeemLicense(licenseKey.trim());
      onUserChange(res.user);
      showToast(res.message);
      setLicenseKey('');
    } catch (err: any) {
      setError(err.message || 'Failed to redeem license');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    serverApi.logout();
    onUserChange(null);
    showToast('Signed out of system');
  };

  const fillAdminCredentials = () => {
    setEmail('admin@smilemachines.internal');
    setPassword('AdminPass2026!');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Internal Database & Auth</h2>
              <p className="text-xs text-gray-400">Multi-tenant server storage & license control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card if already signed in */}
        {currentUser ? (
          <div className="p-6 space-y-6">
            <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 font-bold text-base">
                    {currentUser.name ? currentUser.name[0].toUpperCase() : currentUser.email[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-sm">{currentUser.name || 'User'}</h3>
                    <p className="text-xs text-gray-400">{currentUser.email}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  currentUser.role === 'admin'
                    ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                    : currentUser.licenseTier === 'enterprise'
                    ? 'bg-amber-950/80 text-amber-300 border-amber-500/40'
                    : currentUser.licenseTier === 'pro'
                    ? 'bg-teal-950/80 text-teal-300 border-teal-500/40'
                    : 'bg-gray-800 text-gray-300 border-gray-600'
                }`}>
                  {currentUser.role === 'admin' ? 'Admin' : `${currentUser.licenseTier} License`}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700/60 text-xs">
                <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800">
                  <span className="text-gray-400 block text-[11px]">Database Leads</span>
                  <span className="font-semibold text-white text-sm">
                    {currentUser.totalLeadsStored.toLocaleString()} / {currentUser.maxLeads.toLocaleString()}
                  </span>
                </div>
                <div className="bg-gray-900/60 p-2.5 rounded-lg border border-gray-800">
                  <span className="text-gray-400 block text-[11px]">Concurrent Workers</span>
                  <span className="font-semibold text-white text-sm">
                    {currentUser.maxConcurrentJobs} Jobs
                  </span>
                </div>
              </div>
            </div>

            {/* Redeem License Key */}
            <form onSubmit={handleRedeem} className="space-y-2">
              <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                Upgrade with License Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. ENT-9942-K3L1"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                />
                <button
                  type="submit"
                  disabled={isLoading || !licenseKey.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition-colors"
                >
                  Redeem
                </button>
              </div>
              <p className="text-[11px] text-gray-400">
                Test keys: <code className="text-amber-300">PRO-8821-X9A7</code> (Pro) or <code className="text-amber-300">ENT-9942-K3L1</code> (Enterprise)
              </p>
            </form>

            {/* Admin Console Shortcut */}
            {currentUser.role === 'admin' && onOpenAdminConsole && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAdminConsole();
                }}
                className="w-full py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400" />
                Open Administrator Control Console
              </button>
            )}

            {/* Logout */}
            <div className="pt-2 border-t border-gray-800 flex justify-between items-center">
              <button
                type="button"
                onClick={handleLogout}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out of Account
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Sign In / Sign Up Forms */
          <div className="p-6 space-y-5">
            {/* Nav Tabs */}
            <div className="grid grid-cols-2 p-1 bg-gray-950 rounded-xl border border-gray-800">
              <button
                type="button"
                onClick={() => { setTab('login'); setError(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'login' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setTab('register'); setError(null); }}
                className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                  tab === 'register' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Register New User
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" /> Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
                >
                  {isLoading ? 'Authenticating...' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </button>

                {/* Quick 1-Click Root Administrator Button */}
                <div className="pt-3 border-t border-gray-800">
                  <div className="bg-purple-950/40 border border-purple-500/30 rounded-xl p-3 text-xs space-y-2">
                    <div className="flex items-center gap-2 text-purple-300 font-semibold">
                      <ShieldCheck className="w-4 h-4 text-purple-400" />
                      <span>Root Administrator Access</span>
                    </div>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Log in to manage users, licenses, and background server queues:
                    </p>
                    <button
                      type="button"
                      onClick={fillAdminCredentials}
                      className="w-full py-1.5 px-3 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-200 rounded-lg text-xs font-mono font-medium transition-colors text-center"
                    >
                      Fill Default Admin (admin@smilemachines.internal)
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-gray-400" /> Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Doe"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" /> Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@business.com"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-gray-400" /> Password (min. 6 chars)
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-400" /> License Key (Optional)
                  </label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    placeholder="e.g. PRO-8821-X9A7"
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 uppercase font-mono"
                  />
                  <p className="text-[11px] text-gray-400">Leave blank for Free Starter tier, or enter a license key to unlock Pro/Enterprise.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-emerald-600/20"
                >
                  {isLoading ? 'Creating Account...' : 'Register & Log In'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
