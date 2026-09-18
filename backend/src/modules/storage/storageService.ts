import fs from 'fs';
import path from 'path';
import { config } from '../../config';

export interface IStorageProvider {
  uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<{ storageKey: string; fileUrl: string }>;
  deleteFile(storageKey: string): Promise<boolean>;
}

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = path.resolve(config.storageLocalDir);
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  async uploadFile(fileBuffer: Buffer, fileName: string, mimeType: string, folder: string): Promise<{ storageKey: string; fileUrl: string }> {
    const targetDir = path.join(this.baseDir, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const safeName = `${Date.now()}_${path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const fullPath = path.join(targetDir, safeName);
    fs.writeFileSync(fullPath, fileBuffer);
    const storageKey = `${folder}/${safeName}`;
    const fileUrl = `/api/v1/storage/${storageKey}`;
    return { storageKey, fileUrl };
  }

  async deleteFile(storageKey: string): Promise<boolean> {
    const fullPath = path.join(this.baseDir, storageKey);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      return true;
    }
    return false;
  }
}

export const storageService = new LocalStorageProvider();
