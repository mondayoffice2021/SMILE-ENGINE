import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import readline from 'readline';

// Base data directories
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_DIR = path.join(DATA_DIR, 'db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const EXPORTS_DIR = path.join(DATA_DIR, 'exports');
const LEADS_DIR = path.join(DATA_DIR, 'leads');
const TEMP_STORAGE_DIR = path.join(DATA_DIR, 'temp_storage');

// Ensure base directories exist
for (const dir of [DATA_DIR, DB_DIR, UPLOADS_DIR, EXPORTS_DIR, LEADS_DIR, TEMP_STORAGE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export type UserRole = 'admin' | 'user';
export type LicenseTier = 'free' | 'starter' | 'pro' | 'enterprise';
export type PaymentMethod = 'card' | 'paypal' | 'btc';

export interface PaymentOrderRecord {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  planTier: LicenseTier;
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

export interface PaymentSettingsRecord {
  id: string;
  btcAddress: string;
  paypalEmail: string;
  cardInstructions: string;
  starterPriceUsd: number;
  proPriceUsd: number;
  enterprisePriceUsd: number;
}

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  role: UserRole;
  licenseTier: LicenseTier;
  licenseKey?: string;
  status: 'active' | 'pending_payment' | 'suspended';
  maxLeads: number;
  maxConcurrentJobs: number;
  totalLeadsStored: number;
  createdAt: string;
  lastLoginAt?: string;
  paymentDetails?: PaymentOrderRecord;
}

export interface LicenseRecord {
  key: string;
  tier: LicenseTier;
  maxLeads: number;
  maxConcurrentJobs: number;
  status: 'active' | 'used' | 'revoked';
  assignedToUserId?: string;
  assignedToEmail?: string;
  createdAt: string;
  activatedAt?: string;
  notes?: string;
}

export interface BackgroundJobProgress {
  percent: number;
  processed: number;
  total: number;
  leadsFound: number;
  speedPerSec: number;
  currentStage: string;
  currentFile?: string;
  bytesProcessed?: number;
  totalBytes?: number;
}

export interface BackgroundJobRecord {
  id: string;
  userId: string;
  userEmail: string;
  type: 'file_extraction' | 'text_dump' | 'dork_crawl' | 'url_spider' | 'country_sort' | 'email_validation' | 'mx_sort';
  title: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: BackgroundJobProgress;
  config: {
    sourceFileName?: string;
    filePath?: string;
    query?: string;
    country?: string;
    targetCount?: number;
    extractEmail?: boolean;
    extractPhone?: boolean;
    extractWeb?: boolean;
    verifyMx?: boolean;
    cleanBusiness?: boolean;
    [key: string]: any;
  };
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

export interface StoredLead {
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

export interface SecretVaultRecord {
  id: string;
  userId?: string;
  userEmail?: string;
  vaultName: string;
  category: string;
  itemCount: number;
  fileSizeBytes: number;
  salt: string;
  iv: string;
  tag: string;
  encryptedData: string;
  passwordHash: string;
  notes?: string;
  createdAt: string;
}

export interface TempFileRecord {
  id: string;
  originalName: string;
  filePath: string;
  fileSizeBytes: number;
  totalLines: number;
  previewLines: string[];
  createdAt: string;
}

// Atomic file store helper
class JsonTable<T extends { id?: string; key?: string }> {
  private filePath: string;
  private inMemory: Map<string, T> = new Map();
  private isLoaded = false;
  private keyField: 'id' | 'key';

  constructor(filename: string, keyField: 'id' | 'key' = 'id') {
    this.filePath = path.join(DB_DIR, filename);
    this.keyField = keyField;
  }

  private load(): void {
    if (this.isLoaded) return;
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const items: T[] = JSON.parse(raw);
        for (const item of items) {
          const k = String((item as any)[this.keyField]);
          if (k) this.inMemory.set(k, item);
        }
      }
    } catch (err) {
      console.error(`[DB Error loading ${this.filePath}]:`, err);
    }
    this.isLoaded = true;
  }

  private flush(): void {
    try {
      const items = Array.from(this.inMemory.values());
      const tempPath = `${this.filePath}.${Date.now()}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(items, null, 2), 'utf-8');
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      console.error(`[DB Error flushing ${this.filePath}]:`, err);
    }
  }

  public get(key: string): T | undefined {
    this.load();
    return this.inMemory.get(key);
  }

  public getAll(): T[] {
    this.load();
    return Array.from(this.inMemory.values());
  }

  public find(predicate: (item: T) => boolean): T | undefined {
    this.load();
    for (const item of this.inMemory.values()) {
      if (predicate(item)) return item;
    }
    return undefined;
  }

  public filter(predicate: (item: T) => boolean): T[] {
    this.load();
    return Array.from(this.inMemory.values()).filter(predicate);
  }

  public set(key: string, item: T): void {
    this.load();
    this.inMemory.set(key, item);
    this.flush();
  }

  public delete(key: string): boolean {
    this.load();
    const existed = this.inMemory.delete(key);
    if (existed) this.flush();
    return existed;
  }
}

// Instantiate internal tables
const usersTable = new JsonTable<UserRecord>('users.json', 'id');
const licensesTable = new JsonTable<LicenseRecord>('licenses.json', 'key');
const jobsTable = new JsonTable<BackgroundJobRecord>('jobs.json', 'id');
const paymentsTable = new JsonTable<PaymentOrderRecord>('payments.json', 'id');
const paymentSettingsTable = new JsonTable<PaymentSettingsRecord & { id: string }>('payment_settings.json', 'id');
const vaultTable = new JsonTable<SecretVaultRecord>('secret_vault.json', 'id');
const tempFilesTable = new JsonTable<TempFileRecord>('temp_files.json', 'id');

// Helper for passwords
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, s, 64).toString('hex');
  return { hash, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  try {
    const computed = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hash));
  } catch {
    return false;
  }
}

// Bootstrap default administrator and initial license keys
export function initInternalDatabase(): void {
  // Check if admin user exists
  const existingAdmin = usersTable.find(u => u.role === 'admin');
  if (!existingAdmin) {
    const { hash, salt } = hashPassword('AdminPass2026!');
    const adminUser: UserRecord = {
      id: 'usr_admin_root',
      email: 'admin@smilemachines.internal',
      name: 'System Administrator',
      passwordHash: hash,
      salt,
      role: 'admin',
      licenseTier: 'enterprise',
      status: 'active',
      maxLeads: 1000000,
      maxConcurrentJobs: 20,
      totalLeadsStored: 0,
      createdAt: new Date().toISOString()
    };
    usersTable.set(adminUser.id, adminUser);
    console.log('[Internal DB]: Initialized root administrator account: admin@smilemachines.internal');
  }

  // Ensure payment settings initialized
  if (!paymentSettingsTable.get('global_settings')) {
    paymentSettingsTable.set('global_settings', {
      id: 'global_settings',
      btcAddress: 'bc1qsmilemachines79x882194301enterprisebtc',
      paypalEmail: 'billing@smilemachines.internal',
      cardInstructions: 'Pay via Credit/Debit Card or Wire Transfer with Invoice Reference. Ensure your Account Email is in payment remarks.',
      starterPriceUsd: 49,
      proPriceUsd: 149,
      enterprisePriceUsd: 399
    });
  }

  // Pre-seed test licenses
  const initialLicenses: LicenseRecord[] = [
    {
      key: 'PRO-8821-X9A7',
      tier: 'pro',
      maxLeads: 50000,
      maxConcurrentJobs: 5,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: 'Professional License Tier (50,000 leads, 5 background jobs)'
    },
    {
      key: 'ENT-9942-K3L1',
      tier: 'enterprise',
      maxLeads: 500000,
      maxConcurrentJobs: 25,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: 'Enterprise Tier (500,000 leads, 25 background jobs)'
    },
    {
      key: 'CORP-4401-Z8B5',
      tier: 'enterprise',
      maxLeads: 1000000,
      maxConcurrentJobs: 50,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes: 'Corporate Unlimited License Tier (1,000,000 leads)'
    }
  ];

  for (const lic of initialLicenses) {
    if (!licensesTable.get(lic.key)) {
      licensesTable.set(lic.key, lic);
    }
  }

  // Clean any temporary upload files from previous sessions or restarts
  dbTempStorage.cleanStaleTempFiles();
}

// User Management Methods
export const dbUsers = {
  getById(id: string): UserRecord | undefined {
    return usersTable.get(id);
  },
  getByEmail(email: string): UserRecord | undefined {
    const clean = email.toLowerCase().trim();
    return usersTable.find(u => u.email.toLowerCase() === clean);
  },
  listAll(): Omit<UserRecord, 'passwordHash' | 'salt'>[] {
    return usersTable.getAll().map(({ passwordHash, salt, ...safe }) => safe);
  },
  create(params: {
    email: string;
    name: string;
    password: string;
    role?: UserRole;
    licenseTier?: LicenseTier;
    licenseKey?: string;
    status?: 'active' | 'pending_payment' | 'suspended';
    paymentDetails?: PaymentOrderRecord;
  }): UserRecord {
    const cleanEmail = params.email.toLowerCase().trim();
    if (this.getByEmail(cleanEmail)) {
      throw new Error(`User with email "${cleanEmail}" already exists`);
    }

    const { hash, salt } = hashPassword(params.password);
    const tier = params.licenseTier || 'free';
    const maxLeads = tier === 'enterprise' ? 500000 : tier === 'pro' ? 50000 : tier === 'starter' ? 10000 : 2000;
    const maxJobs = tier === 'enterprise' ? 20 : tier === 'pro' ? 5 : tier === 'starter' ? 3 : 2;

    const user: UserRecord = {
      id: `usr_${crypto.randomUUID().slice(0, 12)}`,
      email: cleanEmail,
      name: params.name.trim() || cleanEmail.split('@')[0],
      passwordHash: hash,
      salt,
      role: params.role || 'user',
      licenseTier: tier,
      licenseKey: params.licenseKey,
      status: params.status || 'active',
      maxLeads,
      maxConcurrentJobs: maxJobs,
      totalLeadsStored: 0,
      createdAt: new Date().toISOString(),
      paymentDetails: params.paymentDetails
    };

    usersTable.set(user.id, user);
    return user;
  },
  update(id: string, updates: Partial<Omit<UserRecord, 'id' | 'salt' | 'passwordHash'>> & { password?: string; paymentDetails?: PaymentOrderRecord }): UserRecord {
    const user = usersTable.get(id);
    if (!user) throw new Error('User not found');

    if (updates.password) {
      const { hash, salt } = hashPassword(updates.password);
      user.passwordHash = hash;
      user.salt = salt;
    }

    if (updates.email) user.email = updates.email.toLowerCase().trim();
    if (updates.name) user.name = updates.name.trim();
    if (updates.role) user.role = updates.role;
    if (updates.paymentDetails) user.paymentDetails = updates.paymentDetails;
    if (updates.licenseTier) {
      user.licenseTier = updates.licenseTier;
      if (user.licenseTier === 'enterprise') {
        user.maxLeads = 500000;
        user.maxConcurrentJobs = 20;
      } else if (user.licenseTier === 'pro') {
        user.maxLeads = 50000;
        user.maxConcurrentJobs = 5;
      } else {
        user.maxLeads = 2000;
        user.maxConcurrentJobs = 2;
      }
    }
    if (updates.status) user.status = updates.status;
    if (updates.maxLeads !== undefined) user.maxLeads = updates.maxLeads;
    if (updates.maxConcurrentJobs !== undefined) user.maxConcurrentJobs = updates.maxConcurrentJobs;
    if (updates.totalLeadsStored !== undefined) user.totalLeadsStored = updates.totalLeadsStored;
    if (updates.lastLoginAt) user.lastLoginAt = updates.lastLoginAt;

    usersTable.set(id, user);
    return user;
  },
  delete(id: string): boolean {
    const user = usersTable.get(id);
    if (!user) return false;
    if (user.role === 'admin' && usersTable.filter(u => u.role === 'admin').length <= 1) {
      throw new Error('Cannot delete the sole administrator account');
    }
    // Delete user leads file
    const leadsFile = path.join(LEADS_DIR, `${id}.json`);
    if (fs.existsSync(leadsFile)) {
      try { fs.unlinkSync(leadsFile); } catch {}
    }
    // Delete user jobs
    for (const job of jobsTable.filter(j => j.userId === id)) {
      jobsTable.delete(job.id);
    }
    return usersTable.delete(id);
  }
};

// License Management Methods
export const dbLicenses = {
  get(key: string): LicenseRecord | undefined {
    return licensesTable.get(key.toUpperCase().trim());
  },
  listAll(): LicenseRecord[] {
    return licensesTable.getAll();
  },
  create(tier: LicenseTier, notes?: string, customMaxLeads?: number): LicenseRecord {
    const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
    const prefix = tier === 'enterprise' ? 'ENT' : tier === 'pro' ? 'PRO' : 'FREE';
    const key = `${prefix}-${randomHex}-${randomSuffix}`;

    const maxLeads = customMaxLeads || (tier === 'enterprise' ? 500000 : tier === 'pro' ? 50000 : 2000);
    const maxJobs = tier === 'enterprise' ? 20 : tier === 'pro' ? 5 : 2;

    const lic: LicenseRecord = {
      key,
      tier,
      maxLeads,
      maxConcurrentJobs: maxJobs,
      status: 'active',
      createdAt: new Date().toISOString(),
      notes
    };

    licensesTable.set(key, lic);
    return lic;
  },
  redeem(key: string, user: UserRecord): { success: boolean; message: string; user?: UserRecord } {
    const lic = licensesTable.get(key.toUpperCase().trim());
    if (!lic) {
      return { success: false, message: 'Invalid license key' };
    }
    if (lic.status === 'used') {
      return { success: false, message: `License key already redeemed by ${lic.assignedToEmail || 'another user'}` };
    }
    if (lic.status === 'revoked') {
      return { success: false, message: 'This license key has been revoked by the administrator' };
    }

    lic.status = 'used';
    lic.assignedToUserId = user.id;
    lic.assignedToEmail = user.email;
    lic.activatedAt = new Date().toISOString();
    licensesTable.set(lic.key, lic);

    const updatedUser = dbUsers.update(user.id, {
      licenseTier: lic.tier,
      maxLeads: lic.maxLeads,
      maxConcurrentJobs: lic.maxConcurrentJobs,
      licenseKey: lic.key
    });

    return {
      success: true,
      message: `Successfully upgraded to ${lic.tier.toUpperCase()} license (${lic.maxLeads.toLocaleString()} leads limit)!`,
      user: updatedUser
    };
  },
  revoke(key: string): boolean {
    const lic = licensesTable.get(key.toUpperCase().trim());
    if (!lic) return false;
    lic.status = 'revoked';
    licensesTable.set(lic.key, lic);
    return true;
  }
};

// Payment Orders & Manual Admin Confirmations
export const dbPayments = {
  createOrder(params: {
    userId: string;
    userEmail: string;
    userName: string;
    planTier: LicenseTier;
    amountUsd: number;
    paymentMethod: PaymentMethod;
    txRef: string;
    notes?: string;
  }): PaymentOrderRecord {
    const order: PaymentOrderRecord = {
      id: `ord_${crypto.randomUUID().slice(0, 12)}`,
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      planTier: params.planTier,
      amountUsd: params.amountUsd,
      paymentMethod: params.paymentMethod,
      txRef: params.txRef.trim(),
      notes: params.notes?.trim(),
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    paymentsTable.set(order.id, order);

    // Update user record
    const user = usersTable.get(params.userId);
    if (user) {
      user.paymentDetails = order;
      usersTable.set(user.id, user);
    }
    return order;
  },

  listAll(): PaymentOrderRecord[] {
    return paymentsTable.getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  getById(id: string): PaymentOrderRecord | undefined {
    return paymentsTable.get(id);
  },

  getByUserId(userId: string): PaymentOrderRecord | undefined {
    const userOrders = paymentsTable.filter(o => o.userId === userId);
    const pending = userOrders.find(o => o.status === 'pending');
    if (pending) return pending;
    return userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  },

  confirmPayment(orderId: string, adminEmail: string): { success: boolean; order: PaymentOrderRecord; user: UserRecord } {
    const order = paymentsTable.get(orderId);
    if (!order) throw new Error('Payment order not found');

    order.status = 'confirmed';
    order.confirmedAt = new Date().toISOString();
    order.confirmedBy = adminEmail;
    paymentsTable.set(order.id, order);

    const user = usersTable.get(order.userId);
    if (!user) throw new Error('User associated with payment order not found');

    // Create and redeem an activated license key for the user
    const lic = dbLicenses.create(
      order.planTier,
      `Activated via ${order.paymentMethod.toUpperCase()} (Ref: ${order.txRef}) by Admin ${adminEmail}`
    );
    dbLicenses.redeem(lic.key, user);

    user.status = 'active';
    user.paymentDetails = order;
    usersTable.set(user.id, user);

    return { success: true, order, user };
  },

  rejectPayment(orderId: string, reason?: string): PaymentOrderRecord {
    const order = paymentsTable.get(orderId);
    if (!order) throw new Error('Payment order not found');

    order.status = 'rejected';
    order.rejectReason = reason || 'Payment transaction reference could not be verified by administrator';
    paymentsTable.set(order.id, order);

    const user = usersTable.get(order.userId);
    if (user && user.paymentDetails?.id === order.id) {
      user.paymentDetails = order;
      usersTable.set(user.id, user);
    }
    return order;
  },

  getSettings(): PaymentSettingsRecord {
    const s = paymentSettingsTable.get('global_settings');
    if (s) return s;
    return {
      id: 'global_settings',
      btcAddress: 'bc1qsmilemachines79x882194301enterprisebtc',
      paypalEmail: 'billing@smilemachines.internal',
      cardInstructions: 'Pay via Credit/Debit Card or Wire Transfer with Invoice Reference. Ensure your Account Email is in payment remarks.',
      starterPriceUsd: 49,
      proPriceUsd: 149,
      enterprisePriceUsd: 399
    };
  },

  updateSettings(updates: Partial<PaymentSettingsRecord>): PaymentSettingsRecord {
    const current = this.getSettings();
    const updated = { ...current, ...updates, id: 'global_settings' };
    paymentSettingsTable.set('global_settings', updated);
    return updated;
  }
};

// Background Jobs Methods
export const dbJobs = {
  get(id: string): BackgroundJobRecord | undefined {
    return jobsTable.get(id);
  },
  getByUser(userId: string): BackgroundJobRecord[] {
    return jobsTable.filter(j => j.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  listAll(): BackgroundJobRecord[] {
    return jobsTable.getAll().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
  create(userId: string, userEmail: string, type: BackgroundJobRecord['type'], title: string, config: any): BackgroundJobRecord {
    const job: BackgroundJobRecord = {
      id: `job_${crypto.randomUUID().slice(0, 12)}`,
      userId,
      userEmail,
      type,
      title,
      status: 'pending',
      progress: {
        percent: 0,
        processed: 0,
        total: 100,
        leadsFound: 0,
        speedPerSec: 0,
        currentStage: 'Queued on server worker engine...'
      },
      config,
      createdAt: new Date().toISOString()
    };
    jobsTable.set(job.id, job);
    return job;
  },
  update(id: string, updates: Partial<BackgroundJobRecord>): BackgroundJobRecord {
    const job = jobsTable.get(id);
    if (!job) throw new Error('Job not found');
    Object.assign(job, updates);
    jobsTable.set(id, job);
    return job;
  },
  delete(id: string, userId?: string): boolean {
    const job = jobsTable.get(id);
    if (!job) return false;
    if (userId && job.userId !== userId) throw new Error('Access denied to job');
    // Also remove file if uploaded
    if (job.config.filePath && fs.existsSync(job.config.filePath)) {
      try { fs.unlinkSync(job.config.filePath); } catch {}
    }
    return jobsTable.delete(id);
  }
};

// Lead Storage with User Isolation (Multi-Tenant Partitioned Store)
export const dbLeads = {
  privateGetUserLeadsPath(userId: string): string {
    return path.join(LEADS_DIR, `${userId}.json`);
  },

  getAllForUser(userId: string): StoredLead[] {
    const p = this.privateGetUserLeadsPath(userId);
    if (!fs.existsSync(p)) return [];
    try {
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return [];
    }
  },

  appendLeadsForUser(userId: string, newLeads: StoredLead[]): number {
    if (newLeads.length === 0) return 0;
    const existing = this.getAllForUser(userId);
    const existingEmails = new Set(existing.map(l => l.email.toLowerCase()));

    const filtered = newLeads.filter(l => !existingEmails.has(l.email.toLowerCase()));
    const combined = [...existing, ...filtered];

    const p = this.privateGetUserLeadsPath(userId);
    const tempP = `${p}.${Date.now()}.tmp`;
    fs.writeFileSync(tempP, JSON.stringify(combined, null, 2), 'utf-8');
    fs.renameSync(tempP, p);

    // Update user lead count
    const user = usersTable.get(userId);
    if (user) {
      user.totalLeadsStored = combined.length;
      usersTable.set(userId, user);
    }

    return filtered.length;
  },

  upsertLeadsForUser(userId: string, incomingLeads: Partial<StoredLead>[]): { added: number; updated: number; total: number } {
    if (!incomingLeads || incomingLeads.length === 0) return { added: 0, updated: 0, total: this.getAllForUser(userId).length };
    const existing = this.getAllForUser(userId);
    const map = new Map<string, StoredLead>();
    for (const item of existing) {
      map.set(item.email.toLowerCase().trim(), { ...item });
    }
    let added = 0;
    let updated = 0;
    for (const inc of incomingLeads) {
      if (!inc.email || !inc.email.includes('@')) continue;
      const em = inc.email.toLowerCase().trim();
      const domain = em.split('@')[1];
      if (map.has(em)) {
        const curr = map.get(em)!;
        if (inc.country && inc.country !== 'Unknown' && inc.country !== 'N/A') curr.country = inc.country;
        if (inc.companyName) curr.companyName = inc.companyName;
        if (inc.phone) curr.phone = inc.phone;
        if (inc.role) curr.role = inc.role;
        if (inc.contactPerson) curr.contactPerson = inc.contactPerson;
        if (inc.sourceUrl) curr.sourceUrl = inc.sourceUrl;
        if (inc.isValid !== undefined) curr.isValid = inc.isValid;
        if (inc.mxStatus && inc.mxStatus !== 'unknown') curr.mxStatus = inc.mxStatus;
        if (inc.mxProvider) curr.mxProvider = inc.mxProvider;
        if (inc.contactType) curr.contactType = inc.contactType;
        updated++;
      } else {
        const newLead: StoredLead = {
          id: inc.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          userId,
          jobId: inc.jobId || 'cloud_upload',
          email: em,
          companyName: inc.companyName || domain?.split('.')[0] || 'Direct Company',
          sourceUrl: inc.sourceUrl || `https://${domain}`,
          country: inc.country || 'N/A',
          phone: inc.phone,
          contactPerson: inc.contactPerson,
          role: inc.role,
          isValid: inc.isValid !== undefined ? inc.isValid : true,
          mxStatus: inc.mxStatus || 'unknown',
          mxProvider: inc.mxProvider,
          contactType: inc.contactType || 'email',
          extractedAt: inc.extractedAt || new Date().toISOString()
        };
        map.set(em, newLead);
        added++;
      }
    }
    const combined = Array.from(map.values());
    const p = this.privateGetUserLeadsPath(userId);
    const tempP = `${p}.${Date.now()}.tmp`;
    fs.writeFileSync(tempP, JSON.stringify(combined, null, 2), 'utf-8');
    fs.renameSync(tempP, p);

    const user = usersTable.get(userId);
    if (user) {
      user.totalLeadsStored = combined.length;
      usersTable.set(userId, user);
    }
    return { added, updated, total: combined.length };
  },

  getPaginated(userId: string, options: {
    page?: number;
    pageSize?: number;
    jobId?: string;
    search?: string;
    country?: string;
    validOnly?: boolean;
    contactType?: string;
  }): {
    leads: StoredLead[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  } {
    let all = this.getAllForUser(userId);

    if (options.jobId) {
      all = all.filter(l => l.jobId === options.jobId);
    }
    if (options.country && options.country !== 'All') {
      const cLower = options.country.toLowerCase();
      all = all.filter(l => l.country.toLowerCase().includes(cLower));
    }
    if (options.validOnly) {
      all = all.filter(l => l.isValid);
    }
    if (options.contactType) {
      all = all.filter(l => l.contactType === options.contactType);
    }
    if (options.search) {
      const q = options.search.toLowerCase();
      all = all.filter(l =>
        l.email.toLowerCase().includes(q) ||
        l.companyName.toLowerCase().includes(q) ||
        (l.phone && l.phone.toLowerCase().includes(q)) ||
        l.sourceUrl.toLowerCase().includes(q)
      );
    }

    const total = all.length;
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.max(1, Math.min(500, options.pageSize || 50));
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const leads = all.slice(startIndex, startIndex + pageSize);

    return {
      leads,
      total,
      page,
      pageSize,
      totalPages
    };
  },

  deleteForJob(userId: string, jobId: string): number {
    const existing = this.getAllForUser(userId);
    const remaining = existing.filter(l => l.jobId !== jobId);
    const p = this.privateGetUserLeadsPath(userId);
    fs.writeFileSync(p, JSON.stringify(remaining, null, 2), 'utf-8');

    const user = usersTable.get(userId);
    if (user) {
      user.totalLeadsStored = remaining.length;
      usersTable.set(userId, user);
    }
    return existing.length - remaining.length;
  },

  clearAllForUser(userId: string): void {
    const p = this.privateGetUserLeadsPath(userId);
    if (fs.existsSync(p)) {
      try { fs.unlinkSync(p); } catch {}
    }
    const user = usersTable.get(userId);
    if (user) {
      user.totalLeadsStored = 0;
      usersTable.set(userId, user);
    }
  }
};

// Encrypted Secret Cloud Vault Methods
export const dbSecretVault = {
  saveVault(params: {
    userId?: string;
    userEmail?: string;
    vaultName: string;
    password: string;
    category?: string;
    data: any;
    itemCount?: number;
    notes?: string;
  }): { id: string; vaultName: string; category: string; itemCount: number; fileSizeBytes: number; createdAt: string } {
    if (!params.vaultName || !params.vaultName.trim()) {
      throw new Error('Vault name is required');
    }
    if (!params.password || params.password.length < 4) {
      throw new Error('Secret password must be at least 4 characters');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = crypto.scryptSync(params.password, Buffer.from(salt, 'hex'), 64).toString('hex');

    // 256-bit AES encryption key
    const key = crypto.scryptSync(params.password, Buffer.from(salt, 'hex'), 32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const serialized = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);
    const bufferData = Buffer.from(serialized, 'utf-8');

    let encrypted = cipher.update(serialized, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    const vaultId = `vlt_${crypto.randomUUID().slice(0, 12)}`;
    const record: SecretVaultRecord = {
      id: vaultId,
      userId: params.userId,
      userEmail: params.userEmail,
      vaultName: params.vaultName.trim(),
      category: params.category || 'general',
      itemCount: params.itemCount || 0,
      fileSizeBytes: bufferData.byteLength,
      salt,
      iv: iv.toString('hex'),
      tag,
      encryptedData: encrypted,
      passwordHash,
      notes: params.notes,
      createdAt: new Date().toISOString()
    };

    vaultTable.set(record.id, record);
    return {
      id: record.id,
      vaultName: record.vaultName,
      category: record.category,
      itemCount: record.itemCount,
      fileSizeBytes: record.fileSizeBytes,
      createdAt: record.createdAt
    };
  },

  unlockVault(vaultId: string, password: string): {
    id: string;
    vaultName: string;
    category: string;
    itemCount: number;
    notes?: string;
    createdAt: string;
    data: any;
  } {
    const record = vaultTable.get(vaultId);
    if (!record) {
      throw new Error('Secret vault not found');
    }

    const checkHash = crypto.scryptSync(password, Buffer.from(record.salt, 'hex'), 64).toString('hex');
    if (!crypto.timingSafeEqual(Buffer.from(checkHash), Buffer.from(record.passwordHash))) {
      throw new Error('Incorrect secret password. Decryption failed.');
    }

    const key = crypto.scryptSync(password, Buffer.from(record.salt, 'hex'), 32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(record.tag, 'hex'));

    let decrypted = decipher.update(record.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    let parsedData: any = decrypted;
    try {
      parsedData = JSON.parse(decrypted);
    } catch {
      // Keep as string
    }

    return {
      id: record.id,
      vaultName: record.vaultName,
      category: record.category,
      itemCount: record.itemCount,
      notes: record.notes,
      createdAt: record.createdAt,
      data: parsedData
    };
  },

  listVaults(userId?: string): Array<{
    id: string;
    vaultName: string;
    category: string;
    itemCount: number;
    fileSizeBytes: number;
    notes?: string;
    createdAt: string;
  }> {
    let all = vaultTable.getAll();
    if (userId) {
      all = all.filter(v => !v.userId || v.userId === userId || v.userId === 'anonymous');
    }
    return all.map(v => ({
      id: v.id,
      vaultName: v.vaultName,
      category: v.category,
      itemCount: v.itemCount,
      fileSizeBytes: v.fileSizeBytes,
      notes: v.notes,
      createdAt: v.createdAt
    })).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  deleteVault(vaultId: string, password?: string, bypassAuth = false): boolean {
    const record = vaultTable.get(vaultId);
    if (!record) return false;

    if (!bypassAuth && password) {
      const checkHash = crypto.scryptSync(password, Buffer.from(record.salt, 'hex'), 64).toString('hex');
      if (!crypto.timingSafeEqual(Buffer.from(checkHash), Buffer.from(record.passwordHash))) {
        throw new Error('Incorrect secret password. Cannot delete vault.');
      }
    } else if (!bypassAuth) {
      throw new Error('Password required to delete encrypted vault');
    }

    return vaultTable.delete(vaultId);
  }
};

// Zero-RAM Temporary Cloud Storage
export const dbTempStorage = {
  cleanStaleTempFiles(): void {
    try {
      if (fs.existsSync(TEMP_STORAGE_DIR)) {
        const files = fs.readdirSync(TEMP_STORAGE_DIR);
        for (const file of files) {
          try {
            const p = path.join(TEMP_STORAGE_DIR, file);
            fs.unlinkSync(p);
          } catch {}
        }
      }
      for (const rec of tempFilesTable.getAll()) {
        tempFilesTable.delete(rec.id);
      }
      console.log('[Cloud Temp Storage] Cleaned up temporary files on server boot.');
    } catch (err: any) {
      console.warn('[Cloud Temp Storage] Cleanup error:', err?.message || err);
    }
  },

  async registerTempFile(originalName: string, diskFilePath: string): Promise<TempFileRecord> {
    const stat = fs.statSync(diskFilePath);
    const tempId = `tmp_${crypto.randomUUID().slice(0, 12)}`;

    let totalLines = 0;
    const previewLines: string[] = [];

    const fileStream = fs.createReadStream(diskFilePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (trimmed) {
        totalLines++;
        if (previewLines.length < 50) {
          previewLines.push(trimmed);
        }
      }
    }

    const record: TempFileRecord = {
      id: tempId,
      originalName,
      filePath: diskFilePath,
      fileSizeBytes: stat.size,
      totalLines,
      previewLines,
      createdAt: new Date().toISOString()
    };

    tempFilesTable.set(record.id, record);
    return record;
  },

  async getChunk(tempId: string, offset: number = 0, limit: number = 5000): Promise<{
    lines: string[];
    totalLines: number;
    offset: number;
    limit: number;
    hasMore: boolean;
    nextOffset: number;
  }> {
    const record = tempFilesTable.get(tempId);
    if (!record || !fs.existsSync(record.filePath)) {
      throw new Error('Temporary file not found or has expired');
    }

    const lines: string[] = [];
    let currentIndex = 0;
    const fileStream = fs.createReadStream(record.filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (currentIndex >= offset && lines.length < limit) {
        lines.push(trimmed);
      }
      currentIndex++;
      if (lines.length >= limit) {
        fileStream.destroy();
        break;
      }
    }

    const hasMore = (offset + lines.length) < record.totalLines;
    return {
      lines,
      totalLines: record.totalLines,
      offset,
      limit,
      hasMore,
      nextOffset: offset + lines.length
    };
  },

  getTempFile(tempId: string): TempFileRecord | undefined {
    return tempFilesTable.get(tempId);
  },

  deleteTempFile(tempId: string): boolean {
    const record = tempFilesTable.get(tempId);
    if (!record) return false;

    if (fs.existsSync(record.filePath)) {
      try {
        fs.unlinkSync(record.filePath);
      } catch {}
    }
    return tempFilesTable.delete(tempId);
  }
};

export { DATA_DIR, UPLOADS_DIR, EXPORTS_DIR, LEADS_DIR, TEMP_STORAGE_DIR };
