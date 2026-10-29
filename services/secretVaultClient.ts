/**
 * Secret Cloud Vault Client
 * Provides military-grade AES-256-GCM encrypted persistence protected by a user-defined password.
 */

export interface VaultMetadata {
  id: string;
  vaultName: string;
  category: string;
  itemCount: number;
  fileSizeBytes: number;
  notes?: string;
  createdAt: string;
}

export interface UnlockedVault {
  id: string;
  vaultName: string;
  category: string;
  itemCount: number;
  notes?: string;
  createdAt: string;
  data: any;
}

export async function saveToSecretVault(params: {
  vaultName: string;
  password: string;
  category?: string;
  data: any;
  itemCount?: number;
  notes?: string;
}): Promise<{ success: boolean; vault: VaultMetadata; message: string }> {
  const token = localStorage.getItem('smile_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/vault/save', {
    method: 'POST',
    headers,
    body: JSON.stringify(params)
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Failed to save to secret vault (status ${res.status})`);
  }
  return json;
}

export async function unlockSecretVault(
  vaultId: string,
  password: string
): Promise<{ success: boolean; vault: UnlockedVault }> {
  const token = localStorage.getItem('smile_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/vault/unlock', {
    method: 'POST',
    headers,
    body: JSON.stringify({ vaultId, password })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Incorrect secret password or vault not found.`);
  }
  return json;
}

export async function listSecretVaults(): Promise<{ success: boolean; vaults: VaultMetadata[] }> {
  const token = localStorage.getItem('smile_auth_token') || '';
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch('/api/vault/list', { headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || `Failed to list vaults (status ${res.status})`);
  }
  return json;
}

export async function deleteSecretVault(vaultId: string, password?: string): Promise<boolean> {
  const token = localStorage.getItem('smile_auth_token') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`/api/vault/${encodeURIComponent(vaultId)}`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ password })
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error || 'Failed to delete secret vault');
  }
  return Boolean(json.success);
}
