import express from 'express';
import crypto from 'crypto';
import {
  dbUsers,
  dbLicenses,
  dbPayments,
  verifyPassword,
  type UserRecord,
  type PaymentMethod,
  type LicenseTier
} from './db';

const JWT_SECRET = process.env.AUTH_SECRET || 'smile-machines-enterprise-secret-key-2026-v3';

export interface AuthRequest extends express.Request {
  user?: UserRecord;
}

// Generate signed token (header.payload.signature)
export function signAuthToken(payload: { userId: string; email: string; role: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyAuthToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Middleware: Authenticate user from header
export function authMiddleware(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || (req.headers['x-auth-token'] as string);
  let token = '';

  if (authHeader && typeof authHeader === 'string') {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (token) {
    const verified = verifyAuthToken(token);
    if (verified && verified.userId) {
      const user = dbUsers.getById(verified.userId);
      if (user && user.status !== 'suspended') {
        req.user = user;
      }
    }
  }

  next();
}

// Middleware: Require valid login
export function requireAuth(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  next();
}

// Middleware: Require Admin role
export function requireAdmin(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrative privileges required.' });
  }
  next();
}

export function registerAuthRoutes(app: express.Express) {
  // Public Payment Options & Pricing Information
  app.get('/api/auth/payment-info', (req, res) => {
    const settings = dbPayments.getSettings();
    return res.json({
      settings: {
        btcAddress: settings.btcAddress,
        paypalEmail: settings.paypalEmail,
        cardInstructions: settings.cardInstructions,
        starterPriceUsd: settings.starterPriceUsd,
        proPriceUsd: settings.proPriceUsd,
        enterprisePriceUsd: settings.enterprisePriceUsd,
      }
    });
  });

  // 1. User Sign Up (with License Key OR Payment Method: Card, PayPal, BTC)
  app.post('/api/auth/register', (req, res) => {
    try {
      const { email, password, name, licenseKey, planTier, paymentMethod, txRef, notes } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long' });
      }

      const existing = dbUsers.getByEmail(email);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email address already exists' });
      }

      const allUsers = dbUsers.listAll();
      const isFirst = allUsers.length === 0;

      let tier: LicenseTier = (planTier as LicenseTier) || 'pro';
      let validLicKey = undefined;
      let initialStatus: 'active' | 'pending_payment' = 'pending_payment';

      // If user enters an active license key: activate immediately!
      if (licenseKey && typeof licenseKey === 'string') {
        const lic = dbLicenses.get(licenseKey);
        if (lic && lic.status === 'active') {
          tier = lic.tier;
          validLicKey = lic.key;
          initialStatus = 'active';
        }
      }

      // First user is root administrator, auto-active
      if (isFirst) {
        initialStatus = 'active';
        tier = 'enterprise';
      }

      const user = dbUsers.create({
        email,
        name: name || email.split('@')[0],
        password,
        role: isFirst ? 'admin' : 'user',
        licenseTier: tier,
        licenseKey: validLicKey,
        status: initialStatus
      });

      if (validLicKey) {
        dbLicenses.redeem(validLicKey, user);
      }

      // If payment submission was provided (Card, PayPal, BTC) and user is pending activation
      let order = undefined;
      if (initialStatus === 'pending_payment' && paymentMethod && txRef) {
        const settings = dbPayments.getSettings();
        const amountUsd = tier === 'enterprise' ? settings.enterprisePriceUsd : tier === 'starter' ? settings.starterPriceUsd : settings.proPriceUsd;
        order = dbPayments.createOrder({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          planTier: tier,
          amountUsd,
          paymentMethod: paymentMethod as PaymentMethod,
          txRef: String(txRef).trim(),
          notes: notes ? String(notes).trim() : undefined
        });
      }

      const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });
      const { passwordHash, salt, ...safeUser } = user;

      return res.json({
        success: true,
        message: initialStatus === 'active'
          ? 'Account successfully registered and activated!'
          : 'Account registered! Your payment reference has been submitted. The administrator will manually confirm payment and activate your license.',
        token,
        user: {
          ...safeUser,
          paymentDetails: order
        }
      });
    } catch (err: any) {
      console.error('[Auth Register Error]:', err);
      return res.status(500).json({ error: err.message || 'Registration failed' });
    }
  });

  // Submit / Update Payment Reference (Card / PayPal / BTC)
  app.post('/api/auth/submit-payment', requireAuth, (req: AuthRequest, res) => {
    try {
      const { planTier, paymentMethod, txRef, notes } = req.body;
      if (!paymentMethod || !txRef) {
        return res.status(400).json({ error: 'Payment method and transaction reference / proof are required' });
      }

      const tier: LicenseTier = (planTier as LicenseTier) || req.user!.licenseTier || 'pro';
      const settings = dbPayments.getSettings();
      const amountUsd = tier === 'enterprise' ? settings.enterprisePriceUsd : tier === 'starter' ? settings.starterPriceUsd : settings.proPriceUsd;

      const order = dbPayments.createOrder({
        userId: req.user!.id,
        userEmail: req.user!.email,
        userName: req.user!.name,
        planTier: tier,
        amountUsd,
        paymentMethod: paymentMethod as PaymentMethod,
        txRef: String(txRef).trim(),
        notes: notes ? String(notes).trim() : undefined
      });

      // Update user status
      const updatedUser = dbUsers.update(req.user!.id, {
        status: 'pending_payment',
        paymentDetails: order
      });

      const { passwordHash, salt, ...safeUser } = updatedUser;
      return res.json({
        success: true,
        message: 'Payment reference submitted! Awaiting administrator manual confirmation.',
        user: safeUser,
        order
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to submit payment reference' });
    }
  });

  // 2. User Sign In
  app.post('/api/auth/login', (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
      }

      const user = dbUsers.getByEmail(email);
      if (!user) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      if (user.status === 'suspended') {
        return res.status(403).json({ error: 'This account has been suspended by the administrator.' });
      }

      const isValid = verifyPassword(password, user.passwordHash, user.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid email or password' });
      }

      // Update last login
      dbUsers.update(user.id, { lastLoginAt: new Date().toISOString() });

      const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });
      const { passwordHash, salt, ...safeUser } = user;

      return res.json({
        success: true,
        message: 'Signed in successfully!',
        token,
        user: safeUser
      });
    } catch (err: any) {
      console.error('[Auth Login Error]:', err);
      return res.status(500).json({ error: err.message || 'Login failed' });
    }
  });

  // 3. Current User Session Check
  app.get('/api/auth/me', (req: AuthRequest, res) => {
    if (!req.user) {
      return res.status(401).json({ authenticated: false });
    }
    const latestOrder = dbPayments.getByUserId(req.user.id);
    const { passwordHash, salt, ...safeUser } = req.user;
    return res.json({
      authenticated: true,
      user: {
        ...safeUser,
        paymentDetails: latestOrder || safeUser.paymentDetails
      }
    });
  });

  // 4. Redeem / Upgrade License Key
  app.post('/api/auth/redeem-license', requireAuth, (req: AuthRequest, res) => {
    try {
      const { licenseKey } = req.body;
      if (!licenseKey) {
        return res.status(400).json({ error: 'License key is required' });
      }

      const outcome = dbLicenses.redeem(licenseKey, req.user!);
      if (!outcome.success) {
        return res.status(400).json({ error: outcome.message });
      }

      const { passwordHash, salt, ...safeUser } = outcome.user!;
      return res.json({
        success: true,
        message: outcome.message,
        user: safeUser
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed to redeem license' });
    }
  });

  // 5. Change Password / Update Profile
  app.post('/api/auth/profile', requireAuth, (req: AuthRequest, res) => {
    try {
      const { name, currentPassword, newPassword } = req.body;
      const updates: any = {};
      if (name) updates.name = name;

      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Current password required to set a new password' });
        }
        const isValid = verifyPassword(currentPassword, req.user!.passwordHash, req.user!.salt);
        if (!isValid) {
          return res.status(400).json({ error: 'Current password is incorrect' });
        }
        if (newPassword.length < 6) {
          return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        updates.password = newPassword;
      }

      const updated = dbUsers.update(req.user!.id, updates);
      const { passwordHash, salt, ...safeUser } = updated;
      return res.json({ success: true, message: 'Profile updated successfully', user: safeUser });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Profile update failed' });
    }
  });
}
