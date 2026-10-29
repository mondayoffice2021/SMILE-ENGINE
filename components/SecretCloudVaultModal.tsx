import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  Lock,
  Unlock,
  Download,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  FolderLock,
  FileArchive,
  RefreshCw,
  X,
  FileText
} from 'lucide-react';
import {
  saveToSecretVault,
  unlockSecretVault,
  listSecretVaults,
  deleteSecretVault,
  type VaultMetadata,
  type UnlockedVault
} from '../services/secretVaultClient';
import { downloadCategoriesAsZip, downloadTextFile } from '../services/exportZip';

export interface SecretCloudVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Optional prefilled data if opened to save current workflow
  initialData?: any;
  defaultVaultName?: string;
  category?: string;
  itemCount?: number;
  onDataLoaded?: (data: any, vaultName: string) => void;
}

export const SecretCloudVaultModal: React.FC<SecretCloudVaultModalProps> = ({
  isOpen,
  onClose,
  initialData,
  defaultVaultName = '',
  category = 'General',
  itemCount = 0,
  onDataLoaded
}) => {
  const [activeTab, setActiveTab] = useState<'save' | 'browse'>(initialData ? 'save' : 'browse');

  // Save State
  const [vaultName, setVaultName] = useState(defaultVaultName || `Secret_Dataset_${new Date().toISOString().slice(0, 10)}`);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Browse / Unlock State
  const [vaults, setVaults] = useState<VaultMetadata[]>([]);
  const [isLoadingVaults, setIsLoadingVaults] = useState(false);
  const [selectedVault, setSelectedVault] = useState<VaultMetadata | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockedVault, setUnlockedVault] = useState<UnlockedVault | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setActiveTab('save');
        setVaultName(defaultVaultName || `Secret_Dataset_${new Date().toISOString().slice(0, 10)}`);
        setSaveSuccess(null);
        setSaveError(null);
      } else {
        setActiveTab('browse');
      }
      loadVaultList();
    }
  }, [isOpen, initialData, defaultVaultName]);

  const loadVaultList = async () => {
    setIsLoadingVaults(true);
    try {
      const res = await listSecretVaults();
      setVaults(res.vaults || []);
    } catch {
      // Ignore or empty
    } finally {
      setIsLoadingVaults(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!vaultName.trim()) {
      setSaveError('Please provide a name for this secret vault');
      return;
    }
    if (!password || password.length < 4) {
      setSaveError('Password must be at least 4 characters long');
      return;
    }
    if (password !== confirmPassword) {
      setSaveError('Passwords do not match');
      return;
    }
    if (!initialData) {
      setSaveError('No active dataset found to encrypt');
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveToSecretVault({
        vaultName: vaultName.trim(),
        password,
        category,
        data: initialData,
        itemCount,
        notes: notes.trim()
      });

      setSaveSuccess(`Vault "${res.vault.vaultName}" securely saved and encrypted with AES-256-GCM!`);
      setPassword('');
      setConfirmPassword('');
      loadVaultList();
    } catch (err: any) {
      setSaveError(err?.message || 'Failed to encrypt and save vault');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVault) return;
    setUnlockError(null);

    if (!unlockPassword) {
      setUnlockError('Please enter your secret password');
      return;
    }

    setIsUnlocking(true);
    try {
      const res = await unlockSecretVault(selectedVault.id, unlockPassword);
      setUnlockedVault(res.vault);
      setUnlockPassword('');
    } catch (err: any) {
      setUnlockError(err?.message || 'Incorrect password. Unable to decrypt vault.');
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleDelete = async (vaultId: string) => {
    try {
      await deleteSecretVault(vaultId, deletePassword);
      setDeleteConfirmId(null);
      setDeletePassword('');
      if (unlockedVault?.id === vaultId) {
        setUnlockedVault(null);
      }
      loadVaultList();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete vault');
    }
  };

  const handleDownloadUnlockedZip = async () => {
    if (!unlockedVault) return;
    const { vaultName, data } = unlockedVault;

    // Check if data is dictionary of categories or array
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const entries = Object.entries(data).map(([cat, content]) => ({
        filename: `${cat.replace(/[^a-zA-Z0-9_-]/g, '_')}.txt`,
        content: Array.isArray(content) ? content.join('\n') : String(content)
      }));
      await downloadCategoriesAsZip(`${vaultName}_Categories`, entries);
    } else if (Array.isArray(data)) {
      const isObjectArray = data.length > 0 && typeof data[0] === 'object';
      if (isObjectArray) {
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map((item: any) => Object.values(item).map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','));
        const csvContent = [headers, ...rows].join('\n');
        await downloadCategoriesAsZip(vaultName, [
          { filename: `${vaultName}.csv`, content: csvContent },
          { filename: 'SUMMARY.txt', content: `Vault: ${vaultName}\nItems: ${data.length}\nDate: ${new Date().toISOString()}` }
        ]);
      } else {
        await downloadCategoriesAsZip(vaultName, [
          { filename: `${vaultName}.txt`, content: data.join('\n') }
        ]);
      }
    } else {
      downloadTextFile(`${vaultName}.txt`, String(data));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-500 text-white shadow-lg shadow-amber-500/20">
              <FolderLock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Secret Cloud Vault
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
                  AES-256-GCM
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Encrypt and save sensitive lead & category datasets with your private passphrase.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-800 bg-slate-900/50 flex gap-4">
          {initialData && (
            <button
              onClick={() => setActiveTab('save')}
              className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
                activeTab === 'save'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-4 h-4" />
              Save Secretly to Cloud ({itemCount.toLocaleString()} items)
            </button>
          )}
          <button
            onClick={() => setActiveTab('browse')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'browse'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderLock className="w-4 h-4" />
            Vault Manager & Unlock ({vaults.length})
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'save' && (
            <form onSubmit={handleSave} className="space-y-5">
              {saveSuccess && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{saveSuccess}</p>
                    <p className="text-xs text-emerald-400/80 mt-1">
                      Data is stored on the server safely. Remember your secret password; without it, no one can decrypt this vault.
                    </p>
                  </div>
                </div>
              )}

              {saveError && (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Encryption Error</p>
                    <p className="text-xs text-rose-400/80 mt-1">{saveError}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Vault Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={vaultName}
                    onChange={(e) => setVaultName(e.target.value)}
                    placeholder="e.g. Germany_B2B_March_2026"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Category Tag
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl bg-slate-800/40 border border-slate-700/60 text-amber-400 text-sm font-mono flex items-center justify-between">
                    <span>{category}</span>
                    <span className="text-xs text-slate-400">{itemCount.toLocaleString()} items</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Secret Password / Passphrase <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter secret password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Confirm Secret Password <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat secret password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Optional Notes / Description
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Exported from Country Sorter, High Confidence only"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors text-sm"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/60 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-300 leading-relaxed">
                  Your dataset will be encrypted server-side with <strong className="text-white">AES-256-GCM</strong>.
                  Only someone with this password can decrypt or download it. It is held securely in the cloud without using your browser's memory.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl text-slate-300 hover:bg-slate-800 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-sm font-semibold shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Encrypting & Saving...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      Encrypt & Save to Cloud Vault
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'browse' && (
            <div className="space-y-6">
              {/* Vault List */}
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-200">
                  Stored Encrypted Vaults ({vaults.length})
                </h4>
                <button
                  onClick={loadVaultList}
                  disabled={isLoadingVaults}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingVaults ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {vaults.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-700 rounded-2xl bg-slate-900/40">
                  <FolderLock className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-300 font-medium">No encrypted vaults saved yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Sort or validate leads in any tab and select "Save to Secret Cloud Vault" to encrypt and store them here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {vaults.map((v) => {
                    const isSelected = selectedVault?.id === v.id;
                    const sizeKb = (v.fileSizeBytes / 1024).toFixed(1);
                    return (
                      <div
                        key={v.id}
                        className={`p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                          isSelected
                            ? 'bg-amber-950/20 border-amber-500/70 shadow-lg shadow-amber-500/10'
                            : 'bg-slate-800/60 border-slate-700/70 hover:border-slate-600'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-semibold text-sm text-white truncate" title={v.vaultName}>
                              {v.vaultName}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/80 text-amber-300 font-mono">
                              {v.category}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">
                            {v.itemCount.toLocaleString()} items • {sizeKb} KB
                          </p>
                          {v.notes && (
                            <p className="text-[11px] text-slate-500 italic truncate mb-2">
                              {v.notes}
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Saved {new Date(v.createdAt).toLocaleDateString()} {new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-slate-700/50">
                          <button
                            onClick={() => {
                              setSelectedVault(v);
                              setUnlockedVault(null);
                              setUnlockError(null);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-black'
                                : 'bg-slate-700 hover:bg-slate-600 text-white'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            {isSelected ? 'Selected' : 'Unlock'}
                          </button>

                          {deleteConfirmId === v.id ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="password"
                                placeholder="Password"
                                value={deletePassword}
                                onChange={(e) => setDeletePassword(e.target.value)}
                                className="w-24 px-2 py-1 bg-slate-900 border border-rose-500/60 text-xs rounded text-white"
                              />
                              <button
                                onClick={() => handleDelete(v.id)}
                                className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-semibold rounded"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-slate-400 hover:text-white text-xs px-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(v.id)}
                              className="text-slate-500 hover:text-rose-400 p-1.5 rounded transition-colors"
                              title="Delete Vault"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Unlock Section */}
              {selectedVault && !unlockedVault && (
                <div className="p-5 rounded-2xl bg-amber-950/20 border border-amber-500/40 space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-400" />
                    <h5 className="text-sm font-semibold text-white">
                      Unlock "{selectedVault.vaultName}"
                    </h5>
                  </div>
                  <p className="text-xs text-slate-300">
                    Enter the secret password used when creating this vault to decrypt and download the data.
                  </p>

                  {unlockError && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{unlockError}</span>
                    </div>
                  )}

                  <form onSubmit={handleUnlock} className="flex gap-3">
                    <div className="relative flex-1">
                      <input
                        type={showUnlockPassword ? 'text' : 'password'}
                        required
                        value={unlockPassword}
                        onChange={(e) => setUnlockPassword(e.target.value)}
                        placeholder="Enter secret vault password"
                        className="w-full pl-3.5 pr-10 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-amber-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowUnlockPassword(!showUnlockPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showUnlockPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button
                      type="submit"
                      disabled={isUnlocking}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50 transition-all"
                    >
                      {isUnlocking ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Decrypting...
                        </>
                      ) : (
                        <>
                          <Unlock className="w-4 h-4" />
                          Decrypt & Open
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}

              {/* Unlocked View & Actions */}
              {unlockedVault && (
                <div className="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/40 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" />
                      Vault Decrypted: "{unlockedVault.vaultName}" ({unlockedVault.itemCount} items)
                    </div>
                    <button
                      onClick={() => setUnlockedVault(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Lock again
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={handleDownloadUnlockedZip}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
                    >
                      <FileArchive className="w-4 h-4" />
                      Download Bundled ZIP (.zip)
                    </button>

                    {onDataLoaded && (
                      <button
                        onClick={() => {
                          onDataLoaded(unlockedVault.data, unlockedVault.vaultName);
                          onClose();
                        }}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-xl flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all"
                      >
                        <FileText className="w-4 h-4" />
                        Load Directly Into Active Tab
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
