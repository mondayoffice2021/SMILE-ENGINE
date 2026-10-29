import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type express from 'express';
import { dbSecretVault, dbTempStorage, TEMP_STORAGE_DIR } from './db';
import type { AuthRequest } from './auth';

// Multer storage for zero-RAM cloud temporary uploads
const tempStorageEngine = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    if (!fs.existsSync(TEMP_STORAGE_DIR)) {
      fs.mkdirSync(TEMP_STORAGE_DIR, { recursive: true });
    }
    cb(null, TEMP_STORAGE_DIR);
  },
  filename: (req: any, file: any, cb: any) => {
    const cleanOriginalName = (file.originalname || 'upload.txt').replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `temp_${Date.now()}_${cleanOriginalName}`);
  }
});

const tempUpload = multer({
  storage: tempStorageEngine,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500 MB max temp file
  }
});

export function registerVaultAndTempRoutes(app: express.Application) {
  // --- Zero-RAM Cloud Temp Storage Routes ---

  // Upload file directly to server disk
  app.post('/api/cloud-temp/upload', tempUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const originalName = req.file.originalname || 'uploaded_data.txt';
      const diskFilePath = req.file.path;

      const record = await dbTempStorage.registerTempFile(originalName, diskFilePath);

      const sizeKb = (record.fileSizeBytes / 1024).toFixed(1);
      const sizeFormatted = record.fileSizeBytes > 1024 * 1024 
        ? `${(record.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB` 
        : `${sizeKb} KB`;

      res.json({
        success: true,
        tempId: record.id,
        filename: record.originalName,
        fileSizeBytes: record.fileSizeBytes,
        sizeFormatted,
        totalLines: record.totalLines,
        previewLines: record.previewLines
      });
    } catch (err: any) {
      console.error('[Cloud Temp Storage] Upload Error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to save temporary file to cloud' });
    }
  });

  // Read a chunk of lines from temp file without loading whole file into memory
  app.get('/api/cloud-temp/:tempId/lines', async (req, res) => {
    try {
      const { tempId } = req.params;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = Math.min(10000, parseInt(req.query.limit as string) || 2000);

      const chunk = await dbTempStorage.getChunk(tempId, offset, limit);
      res.json({
        success: true,
        ...chunk
      });
    } catch (err: any) {
      res.status(404).json({ error: err?.message || 'Failed to read lines from temporary storage' });
    }
  });

  // Delete temp file after sorting completes or user resets
  app.delete('/api/cloud-temp/:tempId', (req, res) => {
    try {
      const { tempId } = req.params;
      const deleted = dbTempStorage.deleteTempFile(tempId);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete temporary file' });
    }
  });

  // --- Secret Cloud Vault Routes ---

  // Save secretly to Cloud Vault with Name & Password
  app.post('/api/vault/save', (req: AuthRequest, res) => {
    try {
      const { vaultName, password, category, data, itemCount, notes } = req.body || {};
      if (!vaultName || !vaultName.trim()) {
        return res.status(400).json({ error: 'Vault Name is required' });
      }
      if (!password || password.length < 4) {
        return res.status(400).json({ error: 'Secret password must be at least 4 characters long' });
      }
      if (!data) {
        return res.status(400).json({ error: 'No data provided to save in vault' });
      }

      const userId = req.user?.id || 'anonymous';
      const userEmail = req.user?.email || 'guest@vault.local';

      const result = dbSecretVault.saveVault({
        userId,
        userEmail,
        vaultName,
        password,
        category: category || 'general',
        data,
        itemCount: typeof itemCount === 'number' ? itemCount : (Array.isArray(data) ? data.length : 0),
        notes
      });

      res.json({
        success: true,
        vault: result,
        message: 'Successfully encrypted and stored in secret cloud vault'
      });
    } catch (err: any) {
      console.error('[Vault API] Save Error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to save to secret vault' });
    }
  });

  // Unlock and retrieve vault contents using secret password
  app.post('/api/vault/unlock', (req: AuthRequest, res) => {
    try {
      const { vaultId, password } = req.body || {};
      if (!vaultId || !password) {
        return res.status(400).json({ error: 'Vault ID and Secret Password are required' });
      }

      const unlocked = dbSecretVault.unlockVault(vaultId, password);
      res.json({
        success: true,
        vault: unlocked
      });
    } catch (err: any) {
      res.status(401).json({ error: err?.message || 'Failed to decrypt vault. Incorrect password.' });
    }
  });

  // List all secret vaults (metadata only)
  app.get('/api/vault/list', (req: AuthRequest, res) => {
    try {
      const userId = req.user?.id;
      const vaults = dbSecretVault.listVaults(userId);
      res.json({ success: true, vaults });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list vaults' });
    }
  });

  // Delete a secret vault (requires password or admin role)
  app.delete('/api/vault/:id', (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id);
      const password = typeof req.body?.password === 'string' ? req.body.password : undefined;
      const isAdmin = req.user?.role === 'admin';

      const deleted = dbSecretVault.deleteVault(id, password, isAdmin);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Failed to delete vault' });
    }
  });
}
