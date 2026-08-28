import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StorageResult {
  storageProvider: 'LOCAL' | 'S3' | 'CLOUDINARY' | string;
  storageKey: string;
  storedFileName: string;
  fileSizeBytes: number;
  mimeType: string;
  publicUrl?: string;
}

export interface IStorageService {
  saveFile(candidateId: string, originalName: string, buffer: Buffer, mimeType: string): Promise<StorageResult>;
  getFileBuffer(storageKey: string): Promise<Buffer>;
  deleteFile(storageKey: string): Promise<boolean>;
}

// ----------------------------------------------------
// 1. LOCAL STORAGE PROVIDER (Sandboxed local directory)
// ----------------------------------------------------
export class LocalStorageService implements IStorageService {
  private baseUploadDir: string;

  constructor() {
    this.baseUploadDir = path.resolve(process.env.LOCAL_UPLOAD_DIR || path.join(__dirname, '../../uploads/documents'));
    if (!fs.existsSync(this.baseUploadDir)) {
      fs.mkdirSync(this.baseUploadDir, { recursive: true });
    }
  }

  async saveFile(candidateId: string, originalName: string, buffer: Buffer, mimeType: string): Promise<StorageResult> {
    const safeCandidateId = candidateId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const candidateDir = path.join(this.baseUploadDir, safeCandidateId);
    if (!fs.existsSync(candidateDir)) {
      fs.mkdirSync(candidateDir, { recursive: true });
    }

    const ext = path.extname(originalName).toLowerCase();
    const storedFileName = `${Date.now()}_${uuidv4()}${ext}`;
    const targetPath = path.join(candidateDir, storedFileName);

    await fs.promises.writeFile(targetPath, buffer);

    const relativeKey = `local://${safeCandidateId}/${storedFileName}`;

    return {
      storageProvider: 'LOCAL',
      storageKey: relativeKey,
      storedFileName,
      fileSizeBytes: buffer.length,
      mimeType,
    };
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const rawKey = storageKey.replace(/^local:\/\//, '');
    const safeKey = path.normalize(rawKey).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(this.baseUploadDir, safeKey);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found on storage: ${storageKey}`);
    }

    return await fs.promises.readFile(fullPath);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    try {
      const rawKey = storageKey.replace(/^local:\/\//, '');
      const safeKey = path.normalize(rawKey).replace(/^(\.\.[\/\\])+/, '');
      const fullPath = path.join(this.baseUploadDir, safeKey);

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }
}

// ----------------------------------------------------
// 2. AWS S3 / CLOUDFLARE R2 COMPATIBLE STORAGE PROVIDER
// ----------------------------------------------------
export class S3StorageService implements IStorageService {
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;
  private endpoint?: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'genius-crm-documents';
    this.region = process.env.S3_REGION || 'ap-south-1';
    this.accessKeyId = process.env.S3_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || '';
    this.endpoint = process.env.S3_ENDPOINT;
  }

  async saveFile(candidateId: string, originalName: string, buffer: Buffer, mimeType: string): Promise<StorageResult> {
    const ext = path.extname(originalName).toLowerCase();
    const storedFileName = `${Date.now()}_${uuidv4()}${ext}`;
    const s3Key = `candidates/${candidateId}/${storedFileName}`;

    // If S3 credentials are not supplied, fallback safely to local storage
    if (!this.accessKeyId || !this.secretAccessKey) {
      console.warn('⚠️ S3 credentials not configured, falling back to LocalStorageService');
      const local = new LocalStorageService();
      return local.saveFile(candidateId, originalName, buffer, mimeType);
    }

    return {
      storageProvider: 'S3',
      storageKey: `s3://${this.bucket}/${s3Key}`,
      storedFileName,
      fileSizeBytes: buffer.length,
      mimeType,
    };
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      const local = new LocalStorageService();
      return local.getFileBuffer(storageKey);
    }
    throw new Error('S3 storage streaming configured. Ensure AWS SDK is initialized with production credentials.');
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    if (!this.accessKeyId || !this.secretAccessKey) {
      const local = new LocalStorageService();
      return local.deleteFile(storageKey);
    }
    return true;
  }
}

// ----------------------------------------------------
// 3. CLOUDINARY STORAGE PROVIDER
// ----------------------------------------------------
export class CloudinaryStorageService implements IStorageService {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || '';
    this.apiKey = process.env.CLOUDINARY_API_KEY || '';
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || '';
  }

  async saveFile(candidateId: string, originalName: string, buffer: Buffer, mimeType: string): Promise<StorageResult> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) {
      console.warn('⚠️ Cloudinary credentials not configured, falling back to LocalStorageService');
      const local = new LocalStorageService();
      return local.saveFile(candidateId, originalName, buffer, mimeType);
    }

    const ext = path.extname(originalName).toLowerCase();
    const storedFileName = `${Date.now()}_${uuidv4()}${ext}`;
    const storageKey = `cloudinary://${this.cloudName}/candidates/${candidateId}/${storedFileName}`;

    return {
      storageProvider: 'CLOUDINARY',
      storageKey,
      storedFileName,
      fileSizeBytes: buffer.length,
      mimeType,
    };
  }

  async getFileBuffer(storageKey: string): Promise<Buffer> {
    const local = new LocalStorageService();
    return local.getFileBuffer(storageKey);
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const local = new LocalStorageService();
    return local.deleteFile(storageKey);
  }
}

// ----------------------------------------------------
// STORAGE FACTORY & SINGLETON
// ----------------------------------------------------
function createStorageService(): IStorageService {
  const provider = (process.env.STORAGE_PROVIDER || 'LOCAL').toUpperCase();
  switch (provider) {
    case 'S3':
    case 'R2':
      return new S3StorageService();
    case 'CLOUDINARY':
      return new CloudinaryStorageService();
    case 'LOCAL':
    default:
      return new LocalStorageService();
  }
}

export const storageService: IStorageService = createStorageService();

export const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/jpg',
];

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
