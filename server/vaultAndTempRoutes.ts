import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type express from 'express';
import { dbSecretVault, dbTempStorage, dbCloudFiles, dbCheckpoints, TEMP_STORAGE_DIR, CLOUD_FILES_DIR } from './db';
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

// Multer storage for persistent Cloud File Hub
const cloudFileStorageEngine = multer.diskStorage({
  destination: (req: any, file: any, cb: any) => {
    if (!fs.existsSync(CLOUD_FILES_DIR)) {
      fs.mkdirSync(CLOUD_FILES_DIR, { recursive: true });
    }
    cb(null, CLOUD_FILES_DIR);
  },
  filename: (req: any, file: any, cb: any) => {
    const cleanOriginalName = (file.originalname || 'cloud_file.txt').replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `cfile_${Date.now()}_${cleanOriginalName}`);
  }
});

const cloudFileUpload = multer({
  storage: cloudFileStorageEngine,
  limits: {
    fileSize: 1024 * 1024 * 500 // 500 MB max cloud file
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

  // --- Persistent Cloud File Hub Routes ---

  // Upload file to persistent Cloud File Hub
  app.post('/api/cloud-files/upload', cloudFileUpload.single('file'), async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const originalName = req.file.originalname || 'uploaded_leads.txt';
      const diskFilePath = req.file.path;
      const sourceTab = req.body?.sourceTab || 'global';
      const userId = req.user?.id || 'anonymous';

      const record = await dbCloudFiles.registerCloudFile(originalName, diskFilePath, sourceTab, userId);

      res.json({
        success: true,
        file: record
      });
    } catch (err: any) {
      console.error('[Cloud File Hub] Upload Error:', err?.message || err);
      res.status(500).json({ error: err?.message || 'Failed to register cloud file' });
    }
  });

  // List all uploaded cloud files
  app.get('/api/cloud-files', (_req, res) => {
    try {
      const files = dbCloudFiles.listAll();
      res.json({
        success: true,
        files
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list cloud files' });
    }
  });

  // Get cloud file metadata
  app.get('/api/cloud-files/:id', (req, res) => {
    try {
      const file = dbCloudFiles.getById(req.params.id);
      if (!file) {
        return res.status(404).json({ error: 'Cloud file not found' });
      }
      res.json({
        success: true,
        file
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to fetch cloud file' });
    }
  });

  // Stream a chunk of lines from cloud file with 0 browser RAM
  app.get('/api/cloud-files/:id/lines', async (req, res) => {
    try {
      const { id } = req.params;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = Math.min(10000, parseInt(req.query.limit as string) || 2000);

      const chunk = await dbCloudFiles.getChunk(id, offset, limit);
      res.json({
        success: true,
        ...chunk
      });
    } catch (err: any) {
      res.status(404).json({ error: err?.message || 'Failed to stream lines from cloud file' });
    }
  });

  // Delete cloud file
  app.delete('/api/cloud-files/:id', (req, res) => {
    try {
      const deleted = dbCloudFiles.delete(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to delete cloud file' });
    }
  });

  // --- Session Checkpoint & Recovery Routes ---

  // Save auto-checkpoint as operation runs
  app.post('/api/checkpoints/save', (req, res) => {
    try {
      const { tab, title, totalItems, processedCount, remainingItems, processedResults, auditEvidence, filterSummary, tempFileId, tempFileOffset, status } = req.body || {};
      if (!tab) {
        return res.status(400).json({ error: 'Tab is required for checkpoint' });
      }

      const checkpoint = dbCheckpoints.saveCheckpoint({
        tab,
        title,
        totalItems,
        processedCount,
        remainingItems,
        processedResults,
        auditEvidence,
        filterSummary,
        tempFileId,
        tempFileOffset,
        status: status || 'running'
      });

      res.json({
        success: true,
        checkpoint
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save checkpoint' });
    }
  });

  // Get active/unfinished checkpoint for a tab
  app.get('/api/checkpoints/active', (req, res) => {
    try {
      const tab = req.query.tab as string | undefined;
      const checkpoint = dbCheckpoints.getActive(tab);
      res.json({
        success: true,
        checkpoint: checkpoint || null
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to get active checkpoint' });
    }
  });

  // List all checkpoints
  app.get('/api/checkpoints/list', (_req, res) => {
    try {
      const checkpoints = dbCheckpoints.listAll();
      res.json({
        success: true,
        checkpoints
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list checkpoints' });
    }
  });

  // Delete/Clear checkpoint
  app.delete('/api/checkpoints/:id', (req, res) => {
    try {
      const deleted = dbCheckpoints.delete(req.params.id);
      res.json({ success: deleted });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to clear checkpoint' });
    }
  });
}
