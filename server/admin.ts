import express from 'express';
import os from 'os';
import { dbUsers, dbLicenses, dbJobs, dbLeads, dbPayments, type LicenseTier, type UserRole } from './db';
import { requireAdmin, type AuthRequest } from './auth';

export function registerAdminRoutes(app: express.Express) {
  // 1. System Telemetry & Server Hardware Stats
  app.get('/api/admin/system-stats', requireAdmin, (req: AuthRequest, res) => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = Math.round((usedMem / totalMem) * 100);

    const users = dbUsers.listAll();
    const allJobs = dbJobs.listAll();
    const activeJobs = allJobs.filter(j => j.status === 'running' || j.status === 'pending');
    const totalLeads = users.reduce((acc, u) => acc + (u.totalLeadsStored || 0), 0);

    return res.json({
      server: {
        nodeVersion: process.version,
        platform: os.platform(),
        cpus: os.cpus().length,
        memory: {
          totalMb: Math.round(totalMem / (1024 * 1024)),
          usedMb: Math.round(usedMem / (1024 * 1024)),
          freeMb: Math.round(freeMem / (1024 * 1024)),
          percentUsed: memUsagePercent
        },
        uptimeHours: Number((os.uptime() / 3600).toFixed(1))
      },
      database: {
        totalUsers: users.length,
        totalLeads,
        totalJobs: allJobs.length,
        activeJobsCount: activeJobs.length,
        totalLicenses: dbLicenses.listAll().length
      }
    });
  });

  // 2. List All Users
  app.get('/api/admin/users', requireAdmin, (req: AuthRequest, res) => {
    const users = dbUsers.listAll();
    return res.json({ users });
  });

  // 3. Create User Manually
  app.post('/api/admin/users', requireAdmin, (req: AuthRequest, res) => {
    try {
      const { email, name, password, role, licenseTier, maxLeads, maxConcurrentJobs } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const user = dbUsers.create({
        email,
        name: name || email.split('@')[0],
        password,
        role: role as UserRole || 'user',
        licenseTier: licenseTier as LicenseTier || 'free'
      });

      if (maxLeads !== undefined || maxConcurrentJobs !== undefined) {
        dbUsers.update(user.id, {
          maxLeads: maxLeads ? parseInt(maxLeads, 10) : undefined,
          maxConcurrentJobs: maxConcurrentJobs ? parseInt(maxConcurrentJobs, 10) : undefined
        });
      }

      const { passwordHash, salt, ...safeUser } = dbUsers.getById(user.id)!;
      return res.json({ success: true, user: safeUser });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 4. Update User (Change Tier, Limits, Suspend, Reset Password)
  app.patch('/api/admin/users/:id', requireAdmin, (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const { name, email, role, licenseTier, status, maxLeads, maxConcurrentJobs, newPassword } = req.body;

      const updates: any = {};
      if (name) updates.name = name;
      if (email) updates.email = email;
      if (role) updates.role = role;
      if (licenseTier) updates.licenseTier = licenseTier;
      if (status) updates.status = status;
      if (maxLeads !== undefined) updates.maxLeads = parseInt(maxLeads, 10);
      if (maxConcurrentJobs !== undefined) updates.maxConcurrentJobs = parseInt(maxConcurrentJobs, 10);
      if (newPassword) updates.password = newPassword;

      const updated = dbUsers.update(String(id), updates);
      const { passwordHash, salt, ...safeUser } = updated;
      return res.json({ success: true, user: safeUser });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 5. Delete User
  app.delete('/api/admin/users/:id', requireAdmin, (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const ok = dbUsers.delete(String(id));
      if (!ok) return res.status(404).json({ error: 'User not found' });
      return res.json({ success: true, message: 'User and all associated data deleted' });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 6. List All Licenses
  app.get('/api/admin/licenses', requireAdmin, (req: AuthRequest, res) => {
    const licenses = dbLicenses.listAll();
    return res.json({ licenses });
  });

  // 7. Generate New License Key
  app.post('/api/admin/licenses', requireAdmin, (req: AuthRequest, res) => {
    try {
      const { tier, notes, customMaxLeads } = req.body;
      if (!tier) {
        return res.status(400).json({ error: 'Tier (free, pro, enterprise) is required' });
      }

      const lic = dbLicenses.create(tier as LicenseTier, notes, customMaxLeads ? parseInt(customMaxLeads, 10) : undefined);
      return res.json({ success: true, license: lic });
    } catch (err: any) {
      return res.status(400).json({ error: err.message });
    }
  });

  // 8. Revoke License Key
  app.post('/api/admin/licenses/:key/revoke', requireAdmin, (req: AuthRequest, res) => {
    const ok = dbLicenses.revoke(String(req.params.key));
    if (!ok) return res.status(404).json({ error: 'License key not found' });
    return res.json({ success: true, message: 'License revoked' });
  });

  // 9. Global Server Jobs Monitor (Admin overview of all background tasks across users)
  app.get('/api/admin/all-jobs', requireAdmin, (req: AuthRequest, res) => {
    const jobs = dbJobs.listAll();
    return res.json({ jobs });
  });

  // 10. List All Payment Orders (Card, PayPal, BTC)
  app.get('/api/admin/payments', requireAdmin, (req: AuthRequest, res) => {
    const orders = dbPayments.listAll();
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    return res.json({ orders, pendingCount });
  });

  // 11. Admin Manually Confirms Payment & Activates User Account
  app.post('/api/admin/payments/:id/confirm', requireAdmin, (req: AuthRequest, res) => {
    try {
      const result = dbPayments.confirmPayment(String(req.params.id), req.user!.email);
      return res.json({
        success: true,
        message: `Payment confirmed! User account "${result.user.email}" has been activated with ${result.order.planTier.toUpperCase()} license.`,
        order: result.order,
        user: result.user
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to confirm payment' });
    }
  });

  // 12. Admin Rejects Payment
  app.post('/api/admin/payments/:id/reject', requireAdmin, (req: AuthRequest, res) => {
    try {
      const { reason } = req.body;
      const order = dbPayments.rejectPayment(String(req.params.id), reason);
      return res.json({
        success: true,
        message: 'Payment rejected',
        order
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to reject payment' });
    }
  });

  // 13. Get Payment Addresses & Pricing Settings
  app.get('/api/admin/payment-settings', requireAdmin, (req: AuthRequest, res) => {
    const settings = dbPayments.getSettings();
    return res.json({ settings });
  });

  // 14. Update Payment Addresses (Card instructions, PayPal email, BTC wallet)
  app.post('/api/admin/payment-settings', requireAdmin, (req: AuthRequest, res) => {
    try {
      const updated = dbPayments.updateSettings(req.body);
      return res.json({
        success: true,
        message: 'Payment receiver settings updated',
        settings: updated
      });
    } catch (err: any) {
      return res.status(400).json({ error: err.message || 'Failed to update payment settings' });
    }
  });
}
