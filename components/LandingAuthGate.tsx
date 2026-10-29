import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  Lock,
  CreditCard,
  Bitcoin,
  CheckCircle2,
  Clock,
  ArrowRight,
  Key,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Mail,
  User,
  Zap,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';
import {
  serverApi,
  setAuthToken,
  type UserProfile,
  type PaymentMethod,
  type PaymentSettings,
  type PaymentOrder
} from '../services/serverApiClient';

interface LandingAuthGateProps {
  currentUser: UserProfile | null;
  onUserAuthenticated: (user: UserProfile) => void;
  showToast: (msg: string) => void;
  onOpenAdminConsole?: () => void;
}

export const LandingAuthGate: React.FC<LandingAuthGateProps> = ({
  currentUser,
  onUserAuthenticated,
  showToast,
  onOpenAdminConsole
}) => {
  // Tabs: 'signin' | 'register' | 'license'
  const [tab, setTab] = useState<'signin' | 'register' | 'license'>('signin');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Receiver & Pricing Settings
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    btcAddress: 'bc1qsmilemachines79x882194301enterprisebtc',
    paypalEmail: 'billing@smilemachines.internal',
    cardInstructions: 'Direct card checkout via merchant gateway or bank reference with your account email.',
    starterPriceUsd: 49,
    proPriceUsd: 149,
    enterprisePriceUsd: 399
  });

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPlan, setRegPlan] = useState<'starter' | 'pro' | 'enterprise'>('pro');
  const [regPaymentMethod, setRegPaymentMethod] = useState<PaymentMethod>('card');
  const [regTxRef, setRegTxRef] = useState('');
  const [regNotes, setRegNotes] = useState('');

  // Direct License form
  const [licKey, setLicKey] = useState('');
  const [licEmail, setLicEmail] = useState('');
  const [licPassword, setLicPassword] = useState('');
  const [licName, setLicName] = useState('');

  // Update Pending Payment form (for existing pending users)
  const [updateTxRef, setUpdateTxRef] = useState('');
  const [updateNotes, setUpdateNotes] = useState('');
  const [updateMethod, setUpdateMethod] = useState<PaymentMethod>('card');
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Fetch live public payment options on mount
  useEffect(() => {
    serverApi.getPublicPaymentInfo()
      .then((res) => {
        if (res && res.settings) {
          setPaymentSettings(res.settings);
        }
      })
      .catch((err) => {
        console.warn('Could not load payment settings:', err);
      });
  }, []);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    showToast(`Copied ${field} to clipboard!`);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showToast('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await serverApi.login(loginEmail.trim(), loginPassword);
      setAuthToken(res.token);
      onUserAuthenticated(res.user);
      if (res.user.status === 'active') {
        showToast(`Welcome back, ${res.user.name || res.user.email}!`);
      } else if (res.user.status === 'pending_payment') {
        showToast('Account loaded. Payment confirmation is pending admin approval.');
      }
    } catch (err: any) {
      showToast(err.message || 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWithPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regEmail || !regPassword) {
      showToast('Email and password are required.');
      return;
    }
    if (regPassword.length < 6) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (!regTxRef.trim()) {
      showToast('Please provide your Transaction ID / Payment Reference or Proof.');
      return;
    }

    setLoading(true);
    try {
      const res = await serverApi.register({
        email: regEmail.trim(),
        password: regPassword,
        name: regName.trim() || regEmail.split('@')[0],
        planTier: regPlan,
        paymentMethod: regPaymentMethod,
        txRef: regTxRef.trim(),
        notes: regNotes.trim() || undefined
      });
      setAuthToken(res.token);
      onUserAuthenticated(res.user);
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterWithLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!licKey.trim()) {
      showToast('Please enter your license key.');
      return;
    }
    if (!licEmail || !licPassword) {
      showToast('Email and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await serverApi.register({
        email: licEmail.trim(),
        password: licPassword,
        name: licName.trim() || licEmail.split('@')[0],
        licenseKey: licKey.trim()
      });
      setAuthToken(res.token);
      onUserAuthenticated(res.user);
      showToast(res.message);
    } catch (err: any) {
      showToast(err.message || 'License activation failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshUserStatus = async () => {
    setCheckingStatus(true);
    try {
      const updated = await serverApi.getCurrentUser();
      if (updated) {
        onUserAuthenticated(updated);
        if (updated.status === 'active') {
          showToast('Congratulations! Your account has been activated by the administrator!');
        } else {
          showToast('Status checked: Payment verification is still pending review by the administrator.');
        }
      }
    } catch (err: any) {
      showToast('Could not refresh status. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleUpdatePaymentProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateTxRef.trim()) {
      showToast('Please provide a valid Transaction Reference.');
      return;
    }
    setLoading(true);
    try {
      const res = await serverApi.submitPayment({
        planTier: currentUser?.licenseTier || 'pro',
        paymentMethod: updateMethod,
        txRef: updateTxRef.trim(),
        notes: updateNotes.trim() || undefined
      });
      onUserAuthenticated(res.user);
      setShowUpdateModal(false);
      showToast('Updated payment reference submitted to the administrator!');
    } catch (err: any) {
      showToast(err.message || 'Failed to submit payment reference.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    serverApi.logout();
    window.location.reload();
  };

  const handleFillAdminDemo = () => {
    setLoginEmail('admin@smilemachines.internal');
    setLoginPassword('AdminPass2026!');
    showToast('Root Administrator credentials loaded.');
  };

  const currentPlanPrice =
    regPlan === 'starter'
      ? paymentSettings.starterPriceUsd
      : regPlan === 'enterprise'
      ? paymentSettings.enterprisePriceUsd
      : paymentSettings.proPriceUsd;

  // -------------------------------------------------------------
  // STATE A: User is logged in, but status is 'pending_payment'
  // -------------------------------------------------------------
  if (currentUser && currentUser.status === 'pending_payment') {
    const details = currentUser.paymentDetails;
    return (
      <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 antialiased selection:bg-emerald-500/30 selection:text-emerald-200">
        {/* Top Header */}
        <header className="max-w-4xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 shadow-lg shadow-amber-500/10">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-200 uppercase">
                  SMILE MACHINES
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-600/40">
                  Verification Pending
                </span>
              </div>
              <h1 className="text-lg font-bold text-slate-100">AI Lead Extractor & Autonomous Spider</h1>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </header>

        {/* Pending Screen Card */}
        <main className="max-w-2xl w-full mx-auto my-auto py-8">
          <div className="bg-slate-900/90 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 text-amber-400 mb-4">
              <div className="p-3 bg-amber-500/20 rounded-2xl border border-amber-500/40 animate-pulse">
                <Clock className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-white">Payment Verification in Progress</h2>
                <p className="text-xs text-amber-300/80">Account activation requires manual confirmation by the administrator</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Thank you for subscribing to SMILE MACHINES! Your account <strong className="text-white underline">{currentUser.email}</strong> is registered.
              To maintain system integrity and prevent unlicensed bot usage, our administrator verifies payment receipts manually before issuing your high-throughput extraction cluster license.
            </p>

            {/* Order Summary Box */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 mb-6">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Target Plan Tier:</span>
                <span className="font-bold text-emerald-400 uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/30">
                  {currentUser.licenseTier.toUpperCase()} LICENSE
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Payment Channel:</span>
                <span className="font-semibold text-slate-200 flex items-center gap-1.5 capitalize">
                  {details?.paymentMethod === 'btc' ? (
                    <>
                      <Bitcoin className="w-4 h-4 text-amber-400" /> Bitcoin (BTC)
                    </>
                  ) : details?.paymentMethod === 'paypal' ? (
                    <>
                      <span className="font-bold text-blue-400">PayPal</span> Transfer
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 text-emerald-400" /> Credit / Debit Card
                    </>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800/80">
                <span className="text-slate-400">Order Amount:</span>
                <span className="font-bold text-white text-sm">
                  ${details?.amountUsd || currentPlanPrice} USD
                </span>
              </div>
              <div className="flex items-start justify-between text-xs gap-3">
                <span className="text-slate-400 shrink-0">Submitted Tx Reference:</span>
                <span className="font-mono text-amber-200/90 text-[11px] break-all bg-slate-900 px-2 py-1 rounded border border-slate-800 max-w-[280px]">
                  {details?.txRef || 'Pending submission'}
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <button
                onClick={handleRefreshUserStatus}
                disabled={checkingStatus}
                className="w-full sm:flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${checkingStatus ? 'animate-spin' : ''}`} />
                {checkingStatus ? 'Checking Activation Status...' : 'Check Activation Status Now'}
              </button>
              <button
                onClick={() => setShowUpdateModal(true)}
                className="w-full sm:w-auto py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
              >
                Update Tx Proof
              </button>
            </div>

            {/* Direct license key shortcut for pending users */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
              <span>Have an instant activation key from admin?</span>
              <button
                onClick={() => {
                  const key = prompt('Enter your Master License Key:');
                  if (key && key.trim()) {
                    serverApi.redeemLicense(key.trim()).then((res) => {
                      onUserAuthenticated(res.user);
                      showToast('License redeemed! Account activated!');
                    }).catch(err => showToast(err.message || 'Invalid key'));
                  }
                }}
                className="text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
              >
                Redeem License Key
              </button>
            </div>
          </div>

          {/* Modal to update Tx Reference */}
          {showUpdateModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-white">Update Payment Reference</h3>
                <p className="text-xs text-slate-400">
                  If you made a typo or have an updated transaction hash or proof, submit it below for the admin to confirm.
                </p>
                <form onSubmit={handleUpdatePaymentProof} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['card', 'paypal', 'btc'] as PaymentMethod[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setUpdateMethod(m)}
                          className={`py-2 px-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1.5 transition ${
                            updateMethod === m
                              ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                              : 'bg-slate-950 border-slate-800 text-slate-400'
                          }`}
                        >
                          {m === 'card' ? 'Card' : m === 'paypal' ? 'PayPal' : 'BTC'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Transaction ID / Hash / Invoice No.</label>
                    <input
                      type="text"
                      value={updateTxRef}
                      onChange={(e) => setUpdateTxRef(e.target.value)}
                      placeholder="e.g. 8f9b... or PayPal Tx # or Invoice Ref"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Notes / Buyer Email (Optional)</label>
                    <input
                      type="text"
                      value={updateNotes}
                      onChange={(e) => setUpdateNotes(e.target.value)}
                      placeholder="Additional payment details"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUpdateModal(false)}
                      className="w-1/2 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-1/2 py-2 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition"
                    >
                      {loading ? 'Submitting...' : 'Save & Submit'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 pt-6 border-t border-slate-900">
          SMILE MACHINES B2B Autonomous Spider Cluster &copy; {new Date().getFullYear()} &bull; Enterprise Secure Partitioning
        </footer>
      </div>
    );
  }

  // -------------------------------------------------------------
  // STATE B: Unauthenticated Landing Page (Sign In, Register, License)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 antialiased selection:bg-blue-500/30 selection:text-blue-200">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-gradient-to-b from-blue-600/10 via-cyan-500/5 to-transparent rounded-full blur-3xl opacity-70" />
        <div className="absolute top-10 right-10 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-10 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      {/* Top Header */}
      <header className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-500/20 via-cyan-500/20 to-purple-500/10 border border-blue-500/30 text-blue-400 shadow-xl shadow-blue-500/10">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-300 uppercase">
                SMILE MACHINES
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-600/40">
                Pro v3.4 Enterprise
              </span>
            </div>
            <h1 className="text-sm text-slate-400">Autonomous B2B Lead Extractor & Server Spider Cluster</h1>
          </div>
        </div>

        {/* Root Admin Demo Quick Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFillAdminDemo}
            className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 hover:bg-purple-900/60 border border-purple-500/40 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow-sm"
            title="Auto-fill default root administrator login"
          >
            <Key className="w-3.5 h-3.5 text-purple-400" />
            Admin Demo Login
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Product Value & Gating Explanation */}
        <div className="lg:col-span-6 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-blue-400 font-semibold shadow-sm">
            <Lock className="w-3.5 h-3.5" />
            Protected License & Multi-Tenant Isolated Cluster
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight">
            Enterprise Email & Company Discovery{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-emerald-400">
              Running In The Cloud
            </span>
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed">
            AI Email Extractor Pro offloads all heavy spidering, deep impressum crawling, MX validation, and large file parsing to an <strong>internal server database</strong>. Your browser never freezes, crashes, or runs out of RAM.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs">
                <Server className="w-4 h-4" />
                Zero Browser Hangs
              </div>
              <p className="text-[11px] text-slate-400">
                Jobs run autonomously on the server. Close your tab and return anytime to export.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                <Layers className="w-4 h-4" />
                Multi-Tenant Isolation
              </div>
              <p className="text-[11px] text-slate-400">
                Complete data separation. Each user has their own private database table and dispatch queue.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                <CreditCard className="w-4 h-4" />
                Card, PayPal & Bitcoin
              </div>
              <p className="text-[11px] text-slate-400">
                Flexible payment options. Verified manually by the administrator for rapid activation.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                Anti-Abuse Verification
              </div>
              <p className="text-[11px] text-slate-400">
                Access is strictly gated to licensed operators to safeguard email deliverability.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication & Subscription Box */}
        <div className="lg:col-span-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
            {/* Tab Selector */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-950 rounded-2xl border border-slate-800 mb-6">
              <button
                type="button"
                onClick={() => setTab('signin')}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  tab === 'signin'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setTab('register')}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  tab === 'register'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Register & Pay
              </button>
              <button
                type="button"
                onClick={() => setTab('license')}
                className={`py-2 text-xs font-bold rounded-xl transition ${
                  tab === 'license'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                License Key
              </button>
            </div>

            {/* TAB 1: SIGN IN */}
            {tab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Account Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="operator@company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">Password</label>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      Sign In to System Cluster
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-slate-500 pt-2">
                  Need a license?{' '}
                  <button
                    type="button"
                    onClick={() => setTab('register')}
                    className="text-blue-400 hover:text-blue-300 font-semibold underline"
                  >
                    Subscribe with Card, PayPal, or BTC
                  </button>
                </p>
              </form>
            )}

            {/* TAB 2: REGISTER WITH PAYMENT (CARD, PAYPAL, BTC) */}
            {tab === 'register' && (
              <form onSubmit={handleRegisterWithPayment} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                {/* User Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Name</label>
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="John Doe"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 mb-1 block">Account Email *</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="user@enterprise.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Password *</label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Plan Tier Selection */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Select License Plan</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegPlan('starter')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        regPlan === 'starter'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase">Starter</div>
                      <div className="text-sm font-extrabold text-emerald-400">${paymentSettings.starterPriceUsd}</div>
                      <div className="text-[10px] text-slate-400">10k leads/mo</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegPlan('pro')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        regPlan === 'pro'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase flex items-center justify-between">
                        <span>Pro</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 rounded">POPULAR</span>
                      </div>
                      <div className="text-sm font-extrabold text-emerald-400">${paymentSettings.proPriceUsd}</div>
                      <div className="text-[10px] text-slate-400">100k leads/mo</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegPlan('enterprise')}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        regPlan === 'enterprise'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[11px] font-bold uppercase">Enterprise</div>
                      <div className="text-sm font-extrabold text-emerald-400">${paymentSettings.enterprisePriceUsd}</div>
                      <div className="text-[10px] text-slate-400">1M+ leads/mo</div>
                    </button>
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Select Payment Method</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegPaymentMethod('card')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        regPaymentMethod === 'card'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <CreditCard className="w-4 h-4 text-blue-400" />
                      Card
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegPaymentMethod('paypal')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        regPaymentMethod === 'paypal'
                          ? 'bg-cyan-600/20 border-cyan-500 text-cyan-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="font-bold text-cyan-400">P</span>
                      PayPal
                    </button>

                    <button
                      type="button"
                      onClick={() => setRegPaymentMethod('btc')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                        regPaymentMethod === 'btc'
                          ? 'bg-amber-600/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Bitcoin className="w-4 h-4 text-amber-400" />
                      Bitcoin
                    </button>
                  </div>
                </div>

                {/* Receiver Payment Details Box based on Method */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 text-xs space-y-2.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Payment Instructions:</span>
                    <span className="font-bold text-emerald-400">Amount Due: ${currentPlanPrice} USD</span>
                  </div>

                  {regPaymentMethod === 'btc' && (
                    <div className="space-y-2">
                      <p className="text-slate-300 text-[11px]">
                        Send ${currentPlanPrice} USD worth of Bitcoin (BTC) to our official receiver address:
                      </p>
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-[11px] text-amber-300">
                        <span className="truncate flex-1">{paymentSettings.btcAddress}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(paymentSettings.btcAddress, 'BTC Address')}
                          className="p-1 hover:text-white text-slate-400 shrink-0"
                          title="Copy BTC Address"
                        >
                          {copiedField === 'BTC Address' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {regPaymentMethod === 'paypal' && (
                    <div className="space-y-2">
                      <p className="text-slate-300 text-[11px]">
                        Send ${currentPlanPrice} USD via PayPal to our billing account:
                      </p>
                      <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2 font-mono text-[11px] text-cyan-300">
                        <span className="truncate flex-1">{paymentSettings.paypalEmail}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(paymentSettings.paypalEmail, 'PayPal Email')}
                          className="p-1 hover:text-white text-slate-400 shrink-0"
                          title="Copy PayPal Email"
                        >
                          {copiedField === 'PayPal Email' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  )}

                  {regPaymentMethod === 'card' && (
                    <div className="space-y-1.5 text-slate-300 text-[11px]">
                      <p>{paymentSettings.cardInstructions}</p>
                      <p className="text-slate-400 text-[10px]">
                        Reference your registration email in your transaction description.
                      </p>
                    </div>
                  )}
                </div>

                {/* Transaction Proof / Tx ID Input */}
                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Transaction ID / Tx Hash / Payment Reference *
                  </label>
                  <input
                    type="text"
                    required
                    value={regTxRef}
                    onChange={(e) => setRegTxRef(e.target.value)}
                    placeholder={
                      regPaymentMethod === 'btc'
                        ? 'e.g. 7f8c9a... (Bitcoin transaction hash)'
                        : regPaymentMethod === 'paypal'
                        ? 'e.g. 8PJ9281... (PayPal transaction ID)'
                        : 'e.g. Card invoice reference / Auth code'
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    The administrator uses this reference to verify payment and activate your cluster account.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">
                    Additional Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={regNotes}
                    onChange={(e) => setRegNotes(e.target.value)}
                    placeholder="Sender name, company or special requests"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Submitting Subscription...
                    </>
                  ) : (
                    <>
                      Submit Payment Proof & Create Account
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* TAB 3: REGISTER OR ACTIVATE WITH LICENSE KEY */}
            {tab === 'license' && (
              <form onSubmit={handleRegisterWithLicense} className="space-y-4">
                <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl text-xs text-purple-200">
                  <p className="font-semibold text-purple-300 flex items-center gap-1.5 mb-1">
                    <Sparkles className="w-3.5 h-3.5" /> Instant Cluster Access
                  </p>
                  Already have an admin-generated license key? Enter it here for instant activation without waiting.
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">License Key *</label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-purple-400 absolute left-3 top-3 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={licKey}
                      onChange={(e) => setLicKey(e.target.value.toUpperCase())}
                      placeholder="SMILE-PRO-XXXXXXXX or SMILE-ENT-XXXXXXXX"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Full Name</label>
                  <input
                    type="text"
                    value={licName}
                    onChange={(e) => setLicName(e.target.value)}
                    placeholder="Your Name"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Account Email *</label>
                  <input
                    type="email"
                    required
                    value={licEmail}
                    onChange={(e) => setLicEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1 block">Password *</label>
                  <input
                    type="password"
                    required
                    value={licPassword}
                    onChange={(e) => setLicPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition disabled:opacity-50 mt-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Activating License...
                    </>
                  ) : (
                    <>
                      Activate License & Enter System
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-6xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 pt-6 border-t border-slate-900">
        <div>
          SMILE MACHINES B2B Intelligence &copy; {new Date().getFullYear()} &bull; Multi-Tenant Database Architecture
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>Card &bull; PayPal &bull; Bitcoin</span>
          <span>Manual Admin Verification</span>
        </div>
      </footer>
    </div>
  );
};
