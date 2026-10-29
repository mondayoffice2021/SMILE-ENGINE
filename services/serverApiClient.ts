/**
 * Server API Client for AI Email Extractor Pro (SMILE MACHINES)
 * Provides authentication, multi-user session management, internal database queries,
 * and server-side background job orchestration without overloading the browser.
 */

const TOKEN_KEY = 'smile_auth_token';

export type PaymentMethod = 'card' | 'paypal' | 'btc';

export interface PaymentOrder {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planTier: 'free' | 'starter' | 'pro' | 'enterprise';
  amountUsd: number;
  paymentMethod: PaymentMethod;
  txRef: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  confirmedAt?: string;
  confirmedBy?: string;
  rejectReason?: string;
}

export interface PaymentSettings {
  btcAddress: string;
  paypalEmail: string;
  cardInstructions: string;
  starterPriceUsd: number;
  proPriceUsd: number;
  enterprisePriceUsd: number;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  licenseTier: 'free' | 'starter' | 'pro' | 'enterprise';
  licenseKey?: string;
  status: 'active' | 'pending_payment' | 'suspended';
  maxLeads: number;
  maxConcurrentJobs: number;
  totalLeadsStored: number;
  createdAt: string;
  lastLoginAt?: string;
  paymentDetails?: PaymentOrder;
}

export interface LicenseItem {
  key: string;
  tier: 'free' | 'starter' | 'pro' | 'enterprise';
  maxLeads: number;
  maxConcurrentJobs: number;
  status: 'active' | 'used' | 'revoked';
  assignedToUserId?: string;
  assignedToEmail?: string;
  createdAt: string;
  activatedAt?: string;
  notes?: string;
}

export interface ServerJob {
  id: string;
  userId: string;
  userEmail: string;
  type: 'file_extraction' | 'text_dump' | 'dork_crawl' | 'url_spider' | 'country_sort' | 'email_validation' | 'mx_sort';
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percent: number;
    processed: number;
    total: number;
    leadsFound: number;
    speedPerSec: number;
    currentStage: string;
    currentFile?: string;
    bytesProcessed?: number;
    totalBytes?: number;
  };
  config: Record<string, any>;
  resultSummary?: {
    totalLeads: number;
    validMxCount: number;
    phoneCount: number;
    websiteCount: number;
    durationMs: number;
    fileSizeMb?: number;
  };
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface ServerLead {
  id: string;
  userId: string;
  jobId: string;
  email: string;
  companyName: string;
  sourceUrl: string;
  country: string;
  phone?: string;
  contactPerson?: string;
  role?: string;
  isValid: boolean;
  mxStatus: 'valid' | 'invalid' | 'unknown';
  mxProvider?: string;
  contactType?: 'email' | 'phone' | 'web';
  extractedAt: string;
}

export interface SystemStats {
  server: {
    nodeVersion: string;
    platform: string;
    cpus: number;
    memory: {
      totalMb: number;
      usedMb: number;
      freeMb: number;
      percentUsed: number;
    };
    uptimeHours: number;
  };
  database: {
    totalUsers: number;
    totalLeads: number;
    totalJobs: number;
    activeJobsCount: number;
    totalLicenses: number;
  };
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const serverApi = {
  // --- Auth APIs ---
  async getCurrentUser(): Promise<UserProfile | null> {
    const token = getAuthToken();
    if (!token) return null;
    try {
      const res = await request<{ authenticated: boolean; user: UserProfile }>('/api/auth/me');
      return res.authenticated ? res.user : null;
    } catch {
      removeAuthToken();
      return null;
    }
  },

  async login(email: string, password: string): Promise<{ user: UserProfile; token: string }> {
    const res = await request<{ user: UserProfile; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setAuthToken(res.token);
    return res;
  },

  async register(params: {
    email: string;
    password: string;
    name?: string;
    licenseKey?: string;
    planTier?: 'free' | 'starter' | 'pro' | 'enterprise';
    paymentMethod?: PaymentMethod;
    txRef?: string;
    notes?: string;
  }): Promise<{ user: UserProfile; token: string; message: string }> {
    const res = await request<{ user: UserProfile; token: string; message: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    setAuthToken(res.token);
    return res;
  },

  async redeemLicense(licenseKey: string): Promise<{ success: boolean; message: string; user: UserProfile }> {
    return request('/api/auth/redeem-license', {
      method: 'POST',
      body: JSON.stringify({ licenseKey })
    });
  },

  async updateProfile(params: { name?: string; currentPassword?: string; newPassword?: string }): Promise<{ user: UserProfile; message: string }> {
    return request('/api/auth/profile', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  logout(): void {
    removeAuthToken();
  },

  // --- Background Jobs APIs ---
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<{ success: boolean; file: { originalName: string; size: number; path: string; filename: string } }> {
    const token = getAuthToken();
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/server-jobs/upload', true);

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const pct = Math.round((event.loaded / event.total) * 100);
            onProgress(pct);
          }
        };
      }

      xhr.onload = () => {
        try {
          const res = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && res.success) {
            resolve(res);
          } else {
            reject(new Error(res.error || `Upload failed with status ${xhr.status}`));
          }
        } catch (e: any) {
          reject(new Error('Invalid response from server upload'));
        }
      };

      xhr.onerror = () => reject(new Error('Network error during file upload to server'));

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  async startJob(
    typeOrOptions: ServerJob['type'] | { type: ServerJob['type']; title: string; config?: any },
    title?: string,
    config?: any
  ): Promise<{ success: boolean; job: ServerJob; message: string }> {
    let payload: { type: ServerJob['type']; title: string; config: any };
    if (typeof typeOrOptions === 'object') {
      payload = {
        type: typeOrOptions.type,
        title: typeOrOptions.title,
        config: typeOrOptions.config || {}
      };
    } else {
      payload = {
        type: typeOrOptions,
        title: title || 'Server Task',
        config: config || {}
      };
    }
    return request('/api/server-jobs/start', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getJobs(): Promise<{ jobs: ServerJob[] }> {
    return request('/api/server-jobs');
  },

  async getJob(id: string): Promise<{ job: ServerJob }> {
    return request(`/api/server-jobs/${id}`);
  },

  async cancelJob(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/server-jobs/${id}/cancel`, { method: 'POST' });
  },

  async deleteJob(id: string, deleteLeads: boolean = false): Promise<{ success: boolean; message: string }> {
    return request(`/api/server-jobs/${id}?deleteLeads=${deleteLeads}`, { method: 'DELETE' });
  },

  // --- Leads Database APIs ---
  async getServerLeads(params: {
    page?: number;
    pageSize?: number;
    jobId?: string;
    search?: string;
    country?: string;
    validOnly?: boolean;
  } = {}): Promise<{
    leads: ServerLead[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.pageSize) searchParams.set('pageSize', String(params.pageSize));
    if (params.jobId) searchParams.set('jobId', params.jobId);
    if (params.search) searchParams.set('search', params.search);
    if (params.country) searchParams.set('country', params.country);
    if (params.validOnly) searchParams.set('validOnly', 'true');

    return request(`/api/server-leads?${searchParams.toString()}`);
  },

  async uploadLeadsToCloudDb(leads: any[], source?: string, jobId?: string): Promise<{
    success: boolean;
    message: string;
    addedCount: number;
    updatedCount: number;
    totalStored: number;
  }> {
    return request('/api/server-leads/batch-upload', {
      method: 'POST',
      body: JSON.stringify({ leads, source, jobId })
    });
  },

  async getAllCloudDbLeads(params?: {
    country?: string;
    validOnly?: boolean;
    jobId?: string;
    limit?: number;
  }): Promise<{
    success: boolean;
    total: number;
    leads: ServerLead[];
  }> {
    const searchParams = new URLSearchParams();
    if (params?.country) searchParams.set('country', params.country);
    if (params?.validOnly) searchParams.set('validOnly', 'true');
    if (params?.jobId) searchParams.set('jobId', params.jobId);
    if (params?.limit) searchParams.set('limit', String(params.limit));

    return request(`/api/server-leads/all?${searchParams.toString()}`);
  },

  async batchUpdateCloudDbLeads(updates: any[]): Promise<{
    success: boolean;
    message: string;
    updatedCount: number;
    totalStored: number;
  }> {
    return request('/api/server-leads/batch-update', {
      method: 'POST',
      body: JSON.stringify({ updates })
    });
  },

  getExportUrl(format: 'csv' | 'xlsx' | 'txt', jobId?: string, validOnly?: boolean): string {
    const token = getAuthToken() || '';
    const params = new URLSearchParams({ format });
    if (jobId) params.set('jobId', jobId);
    if (validOnly) params.set('validOnly', 'true');
    return `/api/server-leads/export?${params.toString()}`;
  },

  async downloadExport(format: 'csv' | 'xlsx' | 'txt', jobId?: string, validOnly?: boolean): Promise<void> {
    const token = getAuthToken();
    const params = new URLSearchParams({ format });
    if (jobId) params.set('jobId', jobId);
    if (validOnly) params.set('validOnly', 'true');

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/server-leads/export?${params.toString()}`, { headers });
    if (!res.ok) throw new Error('Export download failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Smile_Server_Leads_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  },

  async clearAllLeads(): Promise<{ success: boolean; message: string }> {
    return request('/api/server-leads', { method: 'DELETE' });
  },

  // --- Admin APIs ---
  async getSystemStats(): Promise<SystemStats> {
    return request('/api/admin/system-stats');
  },

  async listAdminUsers(): Promise<{ users: UserProfile[] }> {
    return request('/api/admin/users');
  },

  async createAdminUser(data: any): Promise<{ success: boolean; user: UserProfile }> {
    return request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateAdminUser(id: string, updates: any): Promise<{ success: boolean; user: UserProfile }> {
    return request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  },

  async deleteAdminUser(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/users/${id}`, { method: 'DELETE' });
  },

  async listAdminLicenses(): Promise<{ licenses: LicenseItem[] }> {
    return request('/api/admin/licenses');
  },

  async createAdminLicense(data: { tier: 'free' | 'pro' | 'enterprise'; notes?: string; customMaxLeads?: number }): Promise<{ success: boolean; license: LicenseItem }> {
    return request('/api/admin/licenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async revokeAdminLicense(key: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/licenses/${encodeURIComponent(key)}/revoke`, { method: 'POST' });
  },

  async listAllJobsAdmin(): Promise<{ jobs: ServerJob[] }> {
    return request('/api/admin/all-jobs');
  },

  // --- Payment & Activation APIs ---
  async getPublicPaymentInfo(): Promise<{ settings: PaymentSettings }> {
    return request('/api/auth/payment-info');
  },

  async submitPayment(params: {
    planTier: 'free' | 'pro' | 'enterprise';
    paymentMethod: PaymentMethod;
    txRef: string;
    notes?: string;
  }): Promise<{ success: boolean; message: string; user: UserProfile; order: PaymentOrder }> {
    return request('/api/auth/submit-payment', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  },

  async listAdminPayments(): Promise<{ orders: PaymentOrder[]; pendingCount: number }> {
    return request('/api/admin/payments');
  },

  async confirmAdminPayment(orderId: string): Promise<{ success: boolean; message: string; order: PaymentOrder; user: UserProfile }> {
    return request(`/api/admin/payments/${encodeURIComponent(orderId)}/confirm`, {
      method: 'POST'
    });
  },

  async rejectAdminPayment(orderId: string, reason?: string): Promise<{ success: boolean; message: string; order: PaymentOrder }> {
    return request(`/api/admin/payments/${encodeURIComponent(orderId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  },

  async getAdminPaymentSettings(): Promise<{ settings: PaymentSettings }> {
    return request('/api/admin/payment-settings');
  },

  async updateAdminPaymentSettings(updates: Partial<PaymentSettings>): Promise<{ success: boolean; message: string; settings: PaymentSettings }> {
    return request('/api/admin/payment-settings', {
      method: 'POST',
      body: JSON.stringify(updates)
    });
  }
};
