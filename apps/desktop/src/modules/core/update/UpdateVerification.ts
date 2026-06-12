import { invoke } from '@tauri-apps/api/core';

export class UpdateVerification {
  static async verifySHA256(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      const actualHash = await invoke<string>('compute_sha256', { filePath });
      return actualHash.toLowerCase() === expectedHash.toLowerCase();
    } catch (error) {
      console.error('Error verifying SHA256:', error);
      return false;
    }
  }

  static async verifyFileSize(filePath: string, expectedSize: number): Promise<boolean> {
    try {
      const actualSize = await invoke<number>('get_file_size', { filePath });
      return actualSize === expectedSize;
    } catch (error) {
      console.error('Error verifying file size:', error);
      return false;
    }
  }

  static async verifyVersion(version: string, expectedVersion: string): Promise<boolean> {
    return version === expectedVersion;
  }
}
