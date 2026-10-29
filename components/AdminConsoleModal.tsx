import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  ShieldCheck,
  Users,
  Key,
  Server,
  Activity,
  Plus,
  Trash2,
  Edit2,
  Check,
  RefreshCw,
  Cpu,
  HardDrive,
  Database,
  Lock,
  Ban,
  CheckCircle2,
  AlertCircle,
  CreditCard,
  Bitcoin,
  DollarSign,
  Copy,
  Clock
} from 'lucide-react';
import {
  serverApi,
  type UserProfile,
  type LicenseItem,
  type SystemStats,
  type ServerJob,
  type PaymentOrder,
  type PaymentSettings,
  type PaymentMethod
} from '../services/serverApiClient';

interface AdminConsoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  currentUser: UserProfile | null;
}

export const AdminConsoleModal: React.FC<AdminConsoleModalProps> = ({
  isOpen,
  onClose,
  showToast,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'licenses' | 'telemetry' | 'jobs' | 'payments'>('payments');
  const [isLoading, setIsLoading] = useState(false);

  // Data states
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [allJobs, setAllJobs] = useState<ServerJob[]>([]);
  const [payments, setPayments] = useState<PaymentOrder[]>([]);
  const [pendingPaymentsCount, setPendingPaymentsCount] = useState<number>(0);
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected'>('all');
  const [copiedTx, setCopiedTx] = useState<string | null>(null);

  // Settings State
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>({
    btcAddress: '',
    paypalEmail: '',
    cardInstructions: '',
    starterPriceUsd: 49,
    proPriceUsd: 149,
    enterprisePriceUsd: 399
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [rejectModal, setRejectModal] = useState<{ isOpen: boolean; orderId: string; reason: string }>({
    isOpen: false,
    orderId: '',
    reason: 'Payment transaction could not be verified on ledger/merchant statement.'
  });

  // Modals inside Admin
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isAddLicenseOpen, setIsAddLicenseOpen] = useState(false);

  // Form states
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'user',
    licenseTier: 'pro',
    maxLeads: 50000,
    maxConcurrentJobs: 5
  });

  const [editUserForm, setEditUserForm] = useState({
    name: '',
    role: 'user',
    licenseTier: 'pro',
    status: 'active',
    maxLeads: 50000,
    maxConcurrentJobs: 5,
    newPassword: ''
  });

  const [newLicForm, setNewLicForm] = useState({
    tier: 'enterprise' as 'free' | 'pro' | 'enterprise',
    notes: 'Generated via Admin Console',
    customMaxLeads: 100000
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [uRes, lRes, sRes, jRes, pRes, setRes] = await Promise.all([
        serverApi.listAdminUsers().catch(() => ({ users: [] })),
        serverApi.listAdminLicenses().catch(() => ({ licenses: [] })),
        serverApi.getSystemStats().catch(() => null),
        serverApi.listAllJobsAdmin().catch(() => ({ jobs: [] })),
        serverApi.listAdminPayments().catch(() => ({ orders: [], pendingCount: 0 })),
        serverApi.getAdminPaymentSettings().catch(() => ({
          settings: {
            btcAddress: 'bc1qsmilemachines79x882194301enterprisebtc',
            paypalEmail: 'billing@smilemachines.internal',
            cardInstructions: 'Direct card checkout via merchant gateway or bank reference with your account email.',
            starterPriceUsd: 49,
            proPriceUsd: 149,
            enterprisePriceUsd: 399
          }
        }))
      ]);
      setUsers(uRes.users);
      setLicenses(lRes.licenses);
      setStats(sRes);
      setAllJobs(jRes.jobs);
      setPayments(pRes.orders);
      setPendingPaymentsCount(pRes.pendingCount);
      if (setRes && setRes.settings) {
        setPaymentSettings(setRes.settings);
      }
    } catch (err: any) {
      showToast(`Admin load error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await serverApi.createAdminUser(newUserForm);
      showToast(`User ${newUserForm.email} created successfully!`);
      setIsAddUserOpen(false);
      setNewUserForm({
        email: '',
        name: '',
        password: '',
        role: 'user',
        licenseTier: 'pro',
        maxLeads: 50000,
        maxConcurrentJobs: 5
      });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create user');
    }
  };

  const handleOpenEditUser = (user: UserProfile) => {
    setSelectedUser(user);
    setEditUserForm({
      name: user.name || '',
      role: user.role,
      licenseTier: user.licenseTier,
      status: user.status,
      maxLeads: user.maxLeads,
      maxConcurrentJobs: user.maxConcurrentJobs,
      newPassword: ''
    });
    setIsEditUserOpen(true);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      const updates: any = {
        name: editUserForm.name,
        role: editUserForm.role,
        licenseTier: editUserForm.licenseTier,
        status: editUserForm.status,
        maxLeads: editUserForm.maxLeads,
        maxConcurrentJobs: editUserForm.maxConcurrentJobs
      };
      if (editUserForm.newPassword) {
        updates.newPassword = editUserForm.newPassword;
      }
      await serverApi.updateAdminUser(selectedUser.id, updates);
      showToast(`Updated user ${selectedUser.email}`);
      setIsEditUserOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (user: UserProfile) => {
    if (user.role === 'admin' && users.filter(u => u.role === 'admin').length <= 1) {
      showToast('Cannot delete the last admin account');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete user "${user.email}" and all their stored database leads?`)) {
      return;
    }
    try {
      await serverApi.deleteAdminUser(user.id);
      showToast(`User ${user.email} deleted`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user');
    }
  };

  const handleCreateLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await serverApi.createAdminLicense({
        tier: newLicForm.tier,
        notes: newLicForm.notes,
        customMaxLeads: Number(newLicForm.customMaxLeads)
      });
      showToast(`Generated License Key: ${res.license.key}`);
      setIsAddLicenseOpen(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create license');
    }
  };

  const handleRevokeLicense = async (key: string) => {
    if (!window.confirm(`Revoke license key ${key}? Users with this key will not be able to redeem it.`)) return;
    try {
      await serverApi.revokeAdminLicense(key);
      showToast(`License ${key} revoked`);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke license');
    }
  };

  const handleConfirmPayment = async (orderId: string, email: string) => {
    if (!window.confirm(`Confirm payment for user "${email}" and activate their account?`)) return;
    try {
      const res = await serverApi.confirmAdminPayment(orderId);
      showToast(res.message);
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to confirm payment');
    }
  };

  const handleOpenRejectModal = (orderId: string) => {
    setRejectModal({
      isOpen: true,
      orderId,
      reason: 'Transaction reference could not be verified on ledger or merchant statement.'
    });
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal.orderId) return;
    try {
      await serverApi.rejectAdminPayment(rejectModal.orderId, rejectModal.reason);
      showToast('Payment rejected.');
      setRejectModal({ isOpen: false, orderId: '', reason: '' });
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reject payment');
    }
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await serverApi.updateAdminPaymentSettings(paymentSettings);
      showToast('Payment receiving addresses & prices updated successfully!');
      if (res.settings) setPaymentSettings(res.settings);
    } catch (err: any) {
      showToast(err.message || 'Failed to update payment settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCopyTx = (tx: string) => {
    navigator.clipboard.writeText(tx);
    setCopiedTx(tx);
    showToast('Transaction reference copied!');
    setTimeout(() => setCopiedTx(null), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-purple-500/40 rounded-2xl w-full max-w-5xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between bg-gradient-to-r from-purple-950/40 via-gray-900 to-gray-900">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">System Administration Console</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-950 text-purple-300 border border-purple-500/40">
                  Master Root
                </span>
              </div>
              <p className="text-xs text-gray-400">Manage multi-tenant user accounts, license quotas & server resources</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={isLoading}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-purple-400' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-gray-800 flex items-center gap-2 bg-gray-950/60 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payments')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'payments'
                ? 'border-emerald-500 text-emerald-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <span>Payment Approvals</span>
            {pendingPaymentsCount > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950 animate-pulse">
                {pendingPaymentsCount} PENDING
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400">
                {payments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'users'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Users className="w-4 h-4" />
            User Accounts ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'licenses'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Key className="w-4 h-4" />
            Licenses & Tiers ({licenses.length})
          </button>
          <button
            onClick={() => setActiveTab('jobs')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'jobs'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Server className="w-4 h-4" />
            Server Background Tasks ({allJobs.length})
          </button>
          <button
            onClick={() => setActiveTab('telemetry')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors whitespace-nowrap ${
              activeTab === 'telemetry'
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            System Telemetry & RAM
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 0: PAYMENTS & ACTIVATIONS */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* Header & Stats Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-4 h-4 text-amber-400" />
                    <span>Pending Admin Approvals</span>
                  </div>
                  <div className="text-2xl font-bold text-amber-400 font-mono">
                    {pendingPaymentsCount}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Awaiting manual review & license issuance
                  </div>
                </div>

                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                    <span>Total Payment Orders</span>
                  </div>
                  <div className="text-2xl font-bold text-white font-mono">
                    {payments.length}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Card, PayPal & Bitcoin transactions
                  </div>
                </div>

                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <DollarSign className="w-4 h-4 text-cyan-400" />
                    <span>Confirmed Revenue</span>
                  </div>
                  <div className="text-2xl font-bold text-cyan-400 font-mono">
                    ${payments.filter(p => p.status === 'confirmed').reduce((acc, p) => acc + (p.amountUsd || 0), 0)} USD
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {payments.filter(p => p.status === 'confirmed').length} activated accounts
                  </div>
                </div>
              </div>

              {/* Order Filtering Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">Manual Payment Approvals Queue</h3>
                  <span className="text-xs text-gray-400">Review buyer TxRef and confirm to instantly activate license.</span>
                </div>

                <div className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded-xl p-1 text-xs">
                  {(['all', 'pending', 'confirmed', 'rejected'] as const).map((f) => {
                    const count = f === 'all' ? payments.length : payments.filter(p => p.status === f).length;
                    return (
                      <button
                        key={f}
                        onClick={() => setPaymentFilter(f)}
                        className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                          paymentFilter === f
                            ? 'bg-purple-600 text-white font-bold'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {f} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Orders Table */}
              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/80 text-gray-400 uppercase font-mono text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4">User & Contact</th>
                      <th className="py-3 px-4">Plan & Amount</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Tx Reference / Proof</th>
                      <th className="py-3 px-4">Submitted</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Admin Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-sans">
                    {payments
                      .filter(p => paymentFilter === 'all' || p.status === paymentFilter)
                      .map((order) => (
                        <tr key={order.id} className="hover:bg-gray-900/50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-white">{order.userName || 'Operator'}</div>
                            <div className="text-[11px] text-gray-400">{order.userEmail}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-purple-300">
                              {order.planTier}
                            </span>
                            <div className="font-mono text-xs font-bold text-emerald-400 mt-1">
                              ${order.amountUsd} USD
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {order.paymentMethod === 'btc' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-600/40">
                                <Bitcoin className="w-3.5 h-3.5 text-amber-400" /> BTC
                              </span>
                            ) : order.paymentMethod === 'paypal' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-600/40">
                                <span className="font-bold text-cyan-400">P</span> PayPal
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-600/40">
                                <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Card
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[200px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-amber-200 truncate bg-gray-900 px-2 py-0.5 rounded border border-gray-800" title={order.txRef}>
                                {order.txRef}
                              </span>
                              <button
                                onClick={() => handleCopyTx(order.txRef)}
                                className="p-1 text-gray-400 hover:text-white shrink-0"
                                title="Copy Reference"
                              >
                                {copiedTx === order.txRef ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                            {order.notes && (
                              <div className="text-[10px] text-gray-400 mt-0.5 italic truncate" title={order.notes}>
                                Note: {order.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-400 text-[11px] whitespace-nowrap">
                            {new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-3 px-4">
                            {order.status === 'confirmed' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" /> Confirmed
                              </span>
                            ) : order.status === 'rejected' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-400 bg-red-950/60 border border-red-500/40 px-2 py-0.5 rounded-full" title={order.rejectReason}>
                                <Ban className="w-3 h-3" /> Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-950/60 border border-amber-500/40 px-2 py-0.5 rounded-full animate-pulse">
                                <Clock className="w-3 h-3" /> Pending Review
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {order.status === 'pending' ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleConfirmPayment(order.id, order.userEmail)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-sm"
                                  title="Approve payment & activate account"
                                >
                                  <Check className="w-3.5 h-3.5" /> Confirm & Activate
                                </button>
                                <button
                                  onClick={() => handleOpenRejectModal(order.id)}
                                  className="px-2 py-1 bg-gray-800 hover:bg-red-900/60 text-red-400 rounded-lg text-xs font-medium transition"
                                  title="Reject payment"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-gray-500 italic">
                                {order.confirmedBy ? `By ${order.confirmedBy}` : 'Completed'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    {payments.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 text-xs">
                          No payment orders registered in the system yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Receiving Addresses & Price Settings */}
              <div className="bg-gray-950/80 border border-gray-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-purple-400" />
                      Payment Receiver Settings (Card, PayPal, BTC) & Plan Pricing
                    </h4>
                    <p className="text-[11px] text-gray-400">
                      Configure the wallet addresses, merchant instructions, and pricing displayed to new registering users.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleSavePaymentSettings} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Bitcoin (BTC) Receiving Wallet Address
                      </label>
                      <div className="relative">
                        <Bitcoin className="w-4 h-4 text-amber-400 absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          value={paymentSettings.btcAddress}
                          onChange={(e) => setPaymentSettings({ ...paymentSettings, btcAddress: e.target.value })}
                          className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-3 py-2 text-xs text-amber-200 font-mono focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        PayPal Receiving Account Email
                      </label>
                      <input
                        type="email"
                        value={paymentSettings.paypalEmail}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, paypalEmail: e.target.value })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 mb-1 block">
                      Credit / Debit Card Checkout Instructions & Payment Link
                    </label>
                    <textarea
                      rows={2}
                      value={paymentSettings.cardInstructions}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, cardInstructions: e.target.value })}
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Starter Price ($USD)</label>
                      <input
                        type="number"
                        value={paymentSettings.starterPriceUsd}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, starterPriceUsd: Number(e.target.value) })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Pro Price ($USD)</label>
                      <input
                        type="number"
                        value={paymentSettings.proPriceUsd}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, proPriceUsd: Number(e.target.value) })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">Enterprise Price ($USD)</label>
                      <input
                        type="number"
                        value={paymentSettings.enterprisePriceUsd}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, enterprisePriceUsd: Number(e.target.value) })}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isSavingSettings}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-purple-600/20"
                    >
                      {isSavingSettings ? 'Saving Settings...' : 'Save Payment Addresses & Pricing'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 1: USERS */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">Registered Users</h3>
                  <p className="text-xs text-gray-400">Each user has an isolated internal database partition and background worker queue.</p>
                </div>
                <button
                  onClick={() => setIsAddUserOpen(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-purple-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Add User Account
                </button>
              </div>

              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/80 text-gray-400 uppercase font-mono text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">License Tier</th>
                      <th className="py-3 px-4">Database Leads</th>
                      <th className="py-3 px-4">Max Jobs</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-white">{u.name || 'Unnamed'}</div>
                          <div className="text-gray-400 text-[11px] font-mono">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.role === 'admin'
                              ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                              : 'bg-gray-800 text-gray-300'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            u.licenseTier === 'enterprise'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : u.licenseTier === 'pro'
                              ? 'bg-teal-950 text-teal-300 border border-teal-500/40'
                              : 'bg-gray-800 text-gray-400'
                          }`}>
                            {u.licenseTier}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className="text-white font-semibold">{(u.totalLeadsStored || 0).toLocaleString()}</span>
                          <span className="text-gray-500"> / {(u.maxLeads || 0).toLocaleString()}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-300">
                          {u.maxConcurrentJobs || 2} jobs
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            u.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}>
                            {u.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEditUser(u)}
                              className="p-1.5 text-gray-400 hover:text-purple-300 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Edit user license & limits"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="p-1.5 text-gray-400 hover:text-rose-400 hover:bg-gray-800 rounded-lg transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LICENSES */}
          {activeTab === 'licenses' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white">License Quotas & Keys</h3>
                  <p className="text-xs text-gray-400">Generate activation keys to assign to users for tiered lead extraction quotas.</p>
                </div>
                <button
                  onClick={() => setIsAddLicenseOpen(true)}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-lg shadow-amber-600/20"
                >
                  <Plus className="w-4 h-4" />
                  Generate License Key
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl">
                  <div className="text-xs text-gray-400">Free Starter Tier</div>
                  <div className="text-lg font-bold text-white mt-1">2,000 Leads</div>
                  <div className="text-[11px] text-gray-500">2 concurrent background jobs</div>
                </div>
                <div className="p-4 bg-teal-950/30 border border-teal-500/30 rounded-xl">
                  <div className="text-xs text-teal-300 font-semibold">Professional Tier</div>
                  <div className="text-lg font-bold text-white mt-1">50,000 Leads</div>
                  <div className="text-[11px] text-teal-400/70">5 concurrent background workers</div>
                </div>
                <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl">
                  <div className="text-xs text-amber-300 font-semibold">Enterprise Unlimited Tier</div>
                  <div className="text-lg font-bold text-white mt-1">500,000+ Leads</div>
                  <div className="text-[11px] text-amber-400/70">25+ concurrent background workers</div>
                </div>
              </div>

              <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-800/80 text-gray-400 uppercase font-mono text-[10px] tracking-wider border-b border-gray-800">
                    <tr>
                      <th className="py-3 px-4">License Key</th>
                      <th className="py-3 px-4">Tier</th>
                      <th className="py-3 px-4">Lead Limit</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Assigned User</th>
                      <th className="py-3 px-4">Notes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60">
                    {licenses.map((lic) => (
                      <tr key={lic.key} className="hover:bg-gray-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-300 select-all">
                          {lic.key}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            lic.tier === 'enterprise'
                              ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                              : 'bg-teal-950 text-teal-300 border border-teal-500/40'
                          }`}>
                            {lic.tier}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-white">
                          {lic.maxLeads.toLocaleString()} leads
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            lic.status === 'active'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : lic.status === 'used'
                              ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}>
                            {lic.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-gray-400">
                          {lic.assignedToEmail || '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-[11px]">
                          {lic.notes || '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {lic.status === 'active' && (
                            <button
                              onClick={() => handleRevokeLicense(lic.key)}
                              className="px-2 py-1 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded transition-colors"
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: SERVER BACKGROUND JOBS */}
          {activeTab === 'jobs' && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Global Background Server Workers</h3>
                <p className="text-xs text-gray-400">Live view of tasks currently running on the Node.js backend across all users.</p>
              </div>

              {allJobs.length === 0 ? (
                <div className="p-8 text-center bg-gray-950/40 border border-gray-800 rounded-xl text-gray-400 text-xs">
                  No background jobs have been created yet. Launch one from the "Server Background Jobs" tab!
                </div>
              ) : (
                <div className="space-y-3">
                  {allJobs.map((j) => (
                    <div key={j.id} className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            j.status === 'running'
                              ? 'bg-blue-400 animate-pulse'
                              : j.status === 'completed'
                              ? 'bg-emerald-400'
                              : j.status === 'failed'
                              ? 'bg-rose-400'
                              : 'bg-gray-500'
                          }`} />
                          <h4 className="font-semibold text-white text-xs">{j.title}</h4>
                          <span className="text-[10px] text-gray-400 font-mono">({j.userEmail})</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          j.status === 'running'
                            ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                            : j.status === 'completed'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                            : 'bg-gray-800 text-gray-400'
                        }`}>
                          {j.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-gray-400 flex items-center justify-between">
                        <span>{j.progress?.currentStage || 'Idle'}</span>
                        <span className="font-mono text-purple-300">
                          {j.progress?.leadsFound?.toLocaleString() || 0} leads saved
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-purple-500 h-full transition-all duration-300"
                          style={{ width: `${j.progress?.percent || 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TELEMETRY & HARDWARE */}
          {activeTab === 'telemetry' && stats && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Server Hardware & Internal Engine Health</h3>
                <p className="text-xs text-gray-400">Real-time resource utilization on the host system.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <HardDrive className="w-4 h-4 text-purple-400" />
                    <span>RAM Used</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.server.memory.usedMb} MB
                  </div>
                  <div className="text-[10px] text-gray-400">
                    of {stats.server.memory.totalMb} MB ({stats.server.memory.percentUsed}% load)
                  </div>
                </div>

                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Cpu className="w-4 h-4 text-blue-400" />
                    <span>CPU Cores</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.server.cpus} Cores
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Node.js {stats.server.nodeVersion} on {stats.server.platform}
                  </div>
                </div>

                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>Stored DB Leads</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.database.totalLeads.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Across {stats.database.totalUsers} isolated users
                  </div>
                </div>

                <div className="p-4 bg-gray-950/60 border border-gray-800 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Server className="w-4 h-4 text-amber-400" />
                    <span>Server Uptime</span>
                  </div>
                  <div className="text-xl font-bold text-white font-mono">
                    {stats.server.uptimeHours} hrs
                  </div>
                  <div className="text-[10px] text-gray-400">
                    {stats.database.activeJobsCount} active worker threads
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="px-6 py-3 border-t border-gray-800 flex justify-end bg-gray-950">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Close Admin Console
          </button>
        </div>
      </div>

      {/* SUB-MODAL: Add User */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Create New User Account</h3>
              <button onClick={() => setIsAddUserOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-3">
              <div>
                <label className="text-xs text-gray-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300">Name</label>
                <input
                  type="text"
                  value={newUserForm.name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300">Password</label>
                <input
                  type="password"
                  required
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-300">Role</label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">License Tier</label>
                  <select
                    value={newUserForm.licenseTier}
                    onChange={(e) => setNewUserForm({ ...newUserForm, licenseTier: e.target.value as any })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="free">Free (2k leads)</option>
                    <option value="pro">Pro (50k leads)</option>
                    <option value="enterprise">Enterprise (500k leads)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Edit User */}
      {isEditUserOpen && selectedUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Edit User & License Quotas</h3>
                <p className="text-xs text-gray-400 font-mono">{selectedUser.email}</p>
              </div>
              <button onClick={() => setIsEditUserOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditUser} className="space-y-3">
              <div>
                <label className="text-xs text-gray-300">Name</label>
                <input
                  type="text"
                  value={editUserForm.name}
                  onChange={(e) => setEditUserForm({ ...editUserForm, name: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-300">Role</label>
                  <select
                    value={editUserForm.role}
                    onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Status</label>
                  <select
                    value={editUserForm.status}
                    onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-300">License Tier</label>
                  <select
                    value={editUserForm.licenseTier}
                    onChange={(e) => setEditUserForm({ ...editUserForm, licenseTier: e.target.value as any })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-300">Max Leads</label>
                  <input
                    type="number"
                    value={editUserForm.maxLeads}
                    onChange={(e) => setEditUserForm({ ...editUserForm, maxLeads: parseInt(e.target.value, 10) })}
                    className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-300">Reset Password (leave empty to keep unchanged)</label>
                <input
                  type="password"
                  placeholder="New password..."
                  value={editUserForm.newPassword}
                  onChange={(e) => setEditUserForm({ ...editUserForm, newPassword: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditUserOpen(false)}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-semibold"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Add License */}
      {isAddLicenseOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Generate License Key</h3>
              <button onClick={() => setIsAddLicenseOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateLicense} className="space-y-3">
              <div>
                <label className="text-xs text-gray-300">Tier</label>
                <select
                  value={newLicForm.tier}
                  onChange={(e) => {
                    const t = e.target.value as any;
                    const max = t === 'enterprise' ? 500000 : t === 'pro' ? 50000 : 2000;
                    setNewLicForm({ ...newLicForm, tier: t, customMaxLeads: max });
                  }}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="free">Free Tier</option>
                  <option value="pro">Pro Tier</option>
                  <option value="enterprise">Enterprise Tier</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-300">Custom Max Leads Quota</label>
                <input
                  type="number"
                  value={newLicForm.customMaxLeads}
                  onChange={(e) => setNewLicForm({ ...newLicForm, customMaxLeads: parseInt(e.target.value, 10) })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="text-xs text-gray-300">Notes / Client Reference</label>
                <input
                  type="text"
                  placeholder="e.g. Sales team license"
                  value={newLicForm.notes}
                  onChange={(e) => setNewLicForm({ ...newLicForm, notes: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddLicenseOpen(false)}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold"
                >
                  Generate Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SUB-MODAL: Reject Payment */}
      {rejectModal.isOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm text-red-400 flex items-center gap-2">
                <Ban className="w-4 h-4" /> Reject Payment Order
              </h3>
              <button
                onClick={() => setRejectModal({ isOpen: false, orderId: '', reason: '' })}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-300 block mb-1">Reason for Rejection</label>
                <textarea
                  rows={3}
                  required
                  value={rejectModal.reason}
                  onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
                  placeholder="e.g. Transaction hash not found on blockchain / payment was refunded"
                  className="w-full bg-gray-950 border border-gray-700 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModal({ isOpen: false, orderId: '', reason: '' })}
                  className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-semibold"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
