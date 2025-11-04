/**
 * Encryption Service
 * Provides AES-256-GCM encryption for sensitive data storage
 * Uses authenticated encryption to ensure data integrity
 */

import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

export class EncryptionService {
  private static instance: EncryptionService;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly tagLength = 16; // 128 bits
  private readonly saltLength = 32; // 256 bits
  private masterKey: Buffer;
  private encryptionSalt: string;

  private constructor() {
    this.validateEnvironment();
    this.encryptionSalt = this.getOrCreateSalt();
    this.masterKey = this.deriveKey();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is required for encryption key derivation');
    }

    if (process.env.JWT_SECRET.length < 64) {
      throw new Error('JWT_SECRET must be at least 64 characters for secure encryption');
    }
  }

  /**
   * Get or generate encryption salt
   */
  private getOrCreateSalt(): string {
    if (process.env.ENCRYPTION_SALT) {
      return process.env.ENCRYPTION_SALT;
    }

    // Generate a new salt if not exists (should be saved to .env)
    const newSalt = crypto.randomBytes(this.saltLength).toString('hex');
    console.warn('⚠️  ENCRYPTION_SALT not found in environment.');
    console.warn('⚠️  Generated new salt. Add to .env file:');
    console.warn(`ENCRYPTION_SALT=${newSalt}`);
    return newSalt;
  }

  /**
   * Derive encryption key from JWT_SECRET and salt
   */
  private deriveKey(): Buffer {
    const baseSecret = process.env.JWT_SECRET!;
    const salt = Buffer.from(this.encryptionSalt, 'hex');

    // Use PBKDF2 to derive a key from the JWT secret
    return crypto.pbkdf2Sync(baseSecret, salt, 100000, this.keyLength, 'sha256');
  }

  /**
   * Encrypt a string value
   * @returns Object containing encrypted value, IV, and auth tag
   */
  public encrypt(plaintext: string): {
    encrypted: string;
    iv: string;
    authTag: string;
  } {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);

      // Encrypt the plaintext
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get the authentication tag
      const authTag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt an encrypted value
   * @returns Decrypted plaintext string
   */
  public decrypt(encrypted: string, iv: string, authTag: string): string {
    try {
      // Create decipher
      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.masterKey,
        Buffer.from(iv, 'hex')
      );

      // Set the authentication tag
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));

      // Decrypt the ciphertext
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data - possible data corruption or wrong key');
    }
  }

  /**
   * Generate a new random salt (for initial setup)
   */
  public static generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify encryption/decryption is working correctly
   */
  public selfTest(): boolean {
    try {
      const testData = 'test_encryption_data_' + Date.now();
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted.encrypted, encrypted.iv, encrypted.authTag);
      return testData === decrypted;
    } catch (error) {
      console.error('Encryption self-test failed:', error);
      return false;
    }
  }

  /**
   * Rotate encryption key (requires re-encrypting all data)
   * This is a helper method for key rotation operations
   */
  public async rotateKey(
    oldSalt: string,
    newSalt: string,
    reencryptCallback: (oldService: EncryptionService, newService: EncryptionService) => Promise<void>
  ): Promise<void> {
    // Create new instance with new salt
    const oldEncryptionSalt = this.encryptionSalt;
    const oldMasterKey = this.masterKey;

    // Update to new salt
    this.encryptionSalt = newSalt;
    this.masterKey = this.deriveKey();

    // Create temporary old service for decryption
    const oldService = new EncryptionService();
    oldService.encryptionSalt = oldEncryptionSalt;
    oldService.masterKey = oldMasterKey;

    // Execute callback to re-encrypt all data
    await reencryptCallback(oldService, this);
  }

  /**
   * Hash a value using SHA-256 (for non-reversible storage)
   */
  public hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }
}

// Export singleton instance
export const encryptionService = EncryptionService.getInstance();